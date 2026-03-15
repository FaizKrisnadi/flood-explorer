from __future__ import annotations

import argparse
import json
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import pyarrow.parquet as pq
import shapely
from pyproj import Transformer
from shapely import STRtree
from shapely.errors import GEOSException

from pipeline_utils import read_geoparquet_rows, write_geoparquet, write_json, write_tabular_parquet


PROJECT_ROOT = Path(__file__).resolve().parents[1]
RAW_GROUNDSOURCE = PROJECT_ROOT / "data" / "raw" / "groundsource" / "groundsource_2026.parquet"
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"
MANDATORY_LEVELS = ("province", "regency", "district")
PROGRESS_INTERVAL = 100_000
DEFAULT_BATCH_SIZE = 100_000
DEFAULT_VILLAGE_COVERAGE_THRESHOLD = 0.95


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build Groundsource flood facts for Indonesia geography layers."
    )
    parser.add_argument("--groundsource-path", type=Path, default=RAW_GROUNDSOURCE)
    parser.add_argument("--processed-dir", type=Path, default=PROCESSED_DIR)
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
    parser.add_argument("--event-sample-limit", type=int, default=500)
    parser.add_argument(
        "--include-village",
        action="store_true",
        help="Attempt village facts when village boundary coverage meets the configured threshold.",
    )
    parser.add_argument(
        "--village-coverage-threshold",
        type=float,
        default=DEFAULT_VILLAGE_COVERAGE_THRESHOLD,
    )
    return parser.parse_args()


def month_start(date_value: str) -> str:
    return f"{date_value[:7]}-01"


def empty_metric_row(date_key: str, geo_key: str, code: str, key_name: str) -> dict:
    return {
        key_name: date_key,
        geo_key: code,
        "unique_event_count": 0,
        "flood_days": 1,
        "sum_intersection_area_km2": 0.0,
        "max_coverage_ratio": 0.0,
    }


def accumulate_daily(
    store: dict,
    date_key: str,
    geo_key: str,
    code: str,
    area_km2: float,
    coverage_ratio: float,
    key_name: str,
) -> None:
    row = store.setdefault((date_key, code), empty_metric_row(date_key, geo_key, code, key_name))
    row["unique_event_count"] += 1
    row["sum_intersection_area_km2"] += area_km2
    row["max_coverage_ratio"] = max(row["max_coverage_ratio"], coverage_ratio)


def roll_up_monthly(daily_rows: list[dict], geo_key: str, date_key: str) -> list[dict]:
    monthly: dict[tuple[str, str], dict] = {}
    for row in daily_rows:
        month_key = month_start(row[date_key])
        key = (month_key, row[geo_key])
        bucket = monthly.setdefault(
            key,
            {
                "month_start": month_key,
                geo_key: row[geo_key],
                "unique_event_count": 0,
                "flood_days": 0,
                "sum_intersection_area_km2": 0.0,
                "max_coverage_ratio": 0.0,
            },
        )
        bucket["unique_event_count"] += row["unique_event_count"]
        bucket["flood_days"] += 1
        bucket["sum_intersection_area_km2"] += row["sum_intersection_area_km2"]
        bucket["max_coverage_ratio"] = max(bucket["max_coverage_ratio"], row["max_coverage_ratio"])
    return sorted(monthly.values(), key=lambda item: (item["month_start"], item[geo_key]))


def build_empty_manifest(processed_dir: Path, source_path: Path) -> None:
    payload = {
        "generated_at": datetime.now(UTC).isoformat(),
        "status": "missing_groundsource_source",
        "warning": f"Groundsource parquet not found at {source_path}",
        "built_levels": [],
        "artifacts": {},
    }
    write_json(processed_dir / "groundsource_build_manifest.json", payload)


def load_coverage_report(processed_dir: Path) -> dict:
    report_path = processed_dir / "coverage_report.json"
    if not report_path.exists():
        return {}
    return json.loads(report_path.read_text(encoding="utf-8"))


def should_include_village(args: argparse.Namespace, coverage_report: dict) -> tuple[bool, str | None]:
    if not args.include_village:
        return False, "village_metrics_skipped_by_default"
    village_overall = coverage_report.get("overall", {}).get("village", {})
    coverage_ratio = float(village_overall.get("coverage_ratio") or 0.0)
    if coverage_ratio < args.village_coverage_threshold:
        return False, "village_metrics_skipped_low_coverage"
    return True, None


def prepare_boundary_index(level: str, processed_dir: Path, projector: Transformer) -> dict:
    rows = read_geoparquet_rows(processed_dir / f"dim_boundary_{level}.geoparquet")
    geometries = shapely.from_wkb([shapely.to_wkb(row["geometry"]) for row in rows])
    invalid_mask = ~shapely.is_valid(geometries)
    if invalid_mask.any():
        geometries[invalid_mask] = shapely.make_valid(geometries[invalid_mask])

    projected_geometries = shapely.transform(geometries, projector.transform, interleaved=False)
    unit_area_km2 = shapely.area(projected_geometries) / 1_000_000
    geo_key = f"{level}_code"
    return {
        "level": level,
        "geo_key": geo_key,
        "rows": rows,
        "geometries": geometries,
        "projected_geometries": projected_geometries,
        "codes": np.array([row["code"] for row in rows], dtype=object),
        "unit_area_km2": unit_area_km2,
        "tree": STRtree(geometries),
    }


def indonesia_bbox(boundary_index: dict) -> tuple[float, float, float, float]:
    bounds = shapely.bounds(boundary_index["geometries"])
    return (
        float(bounds[:, 0].min()),
        float(bounds[:, 1].min()),
        float(bounds[:, 2].max()),
        float(bounds[:, 3].max()),
    )


def repair_batch_geometries(geometries) -> np.ndarray:
    invalid_mask = ~shapely.is_valid(geometries)
    if invalid_mask.any():
        geometries[invalid_mask] = shapely.make_valid(geometries[invalid_mask])
    return geometries


def intersection_areas_km2(candidate_projected, level_index: dict, pairs: np.ndarray) -> np.ndarray:
    try:
        intersections = shapely.intersection(
            candidate_projected[pairs[0]],
            level_index["projected_geometries"][pairs[1]],
        )
    except GEOSException:
        repaired = shapely.make_valid(candidate_projected[pairs[0]])
        intersections = shapely.intersection(repaired, level_index["projected_geometries"][pairs[1]])
    return shapely.area(intersections) / 1_000_000


def build_event_sample(
    sample_rows: list[dict],
    sample_limit: int,
    event_positions: np.ndarray,
    source_indices: np.ndarray,
    uuids: np.ndarray,
    start_dates: np.ndarray,
    end_dates: np.ndarray,
    footprint_area_km2: np.ndarray,
    candidate_geometries,
) -> None:
    if len(sample_rows) >= sample_limit:
        return
    for event_position in event_positions:
        if len(sample_rows) >= sample_limit:
            return
        source_index = int(source_indices[event_position])
        sample_rows.append(
            {
                "uuid": str(uuids[source_index]),
                "start_date": str(start_dates[source_index]),
                "end_date": str(end_dates[source_index] or start_dates[source_index]),
                "area_km2": float(footprint_area_km2[event_position]),
                "geometry": candidate_geometries[event_position],
            }
        )


def aggregate_level(
    level_index: dict,
    candidate_geometries,
    candidate_projected,
    source_indices: np.ndarray,
    start_dates: np.ndarray,
    daily_store: dict,
) -> tuple[np.ndarray, np.ndarray]:
    pairs = level_index["tree"].query(candidate_geometries, predicate="intersects")
    if pairs.size == 0:
        return np.array([], dtype=int), np.array([], dtype=int)

    areas_km2 = intersection_areas_km2(candidate_projected, level_index, pairs)
    valid_pairs = np.isfinite(areas_km2) & (areas_km2 > 0)
    if not valid_pairs.any():
        return np.array([], dtype=int), np.array([], dtype=int)

    event_positions = pairs[0][valid_pairs]
    unit_positions = pairs[1][valid_pairs]
    area_values = areas_km2[valid_pairs]
    coverage_values = area_values / level_index["unit_area_km2"][unit_positions]
    geo_codes = level_index["codes"][unit_positions]
    event_dates = start_dates[source_indices[event_positions]]

    for event_date, geo_code, area_km2, coverage_ratio in zip(
        event_dates.tolist(),
        geo_codes.tolist(),
        area_values.tolist(),
        coverage_values.tolist(),
        strict=False,
    ):
        accumulate_daily(
            daily_store,
            event_date,
            level_index["geo_key"],
            geo_code,
            area_km2,
            coverage_ratio,
            "event_date",
        )

    return event_positions, unit_positions


def write_level_outputs(processed_dir: Path, level: str, daily_store: dict) -> tuple[int, int]:
    daily_rows = sorted(daily_store.values(), key=lambda item: (item["event_date"], item[f"{level}_code"]))
    if not daily_rows:
        return 0, 0

    monthly_rows = roll_up_monthly(daily_rows, f"{level}_code", "event_date")
    write_tabular_parquet(processed_dir / f"fact_{level}_day.parquet", daily_rows)
    write_tabular_parquet(processed_dir / f"fact_{level}_month.parquet", monthly_rows)
    return len(daily_rows), len(monthly_rows)


def main() -> int:
    args = parse_args()
    args.processed_dir.mkdir(parents=True, exist_ok=True)

    if not args.groundsource_path.exists():
        build_empty_manifest(args.processed_dir, args.groundsource_path)
        print(f"missing {args.groundsource_path}")
        return 0

    coverage_report = load_coverage_report(args.processed_dir)
    if not coverage_report.get("release_gate", {}).get("district_release_ready"):
        raise SystemExit("District release gate is not ready; rebuild reference geography first.")

    projector = Transformer.from_crs("EPSG:4326", "EPSG:6933", always_xy=True)
    enabled_levels = list(MANDATORY_LEVELS)
    warnings: list[str] = []

    include_village, village_warning = should_include_village(args, coverage_report)
    if include_village:
        enabled_levels.append("village")
    elif village_warning:
        warnings.append(village_warning)

    level_indexes = {
        level: prepare_boundary_index(level, args.processed_dir, projector) for level in enabled_levels
    }
    daily_metrics = {level: {} for level in enabled_levels}

    district_bbox = indonesia_bbox(level_indexes["district"])
    parquet = pq.ParquetFile(args.groundsource_path)

    total_rows = 0
    intersecting_event_count = 0
    event_sample: list[dict] = []
    next_progress = PROGRESS_INTERVAL

    for batch in parquet.iter_batches(
        batch_size=args.batch_size,
        columns=["uuid", "area_km2", "geometry", "start_date", "end_date"],
    ):
        batch_rows = batch.num_rows
        uuids = np.array(batch.column("uuid").to_pylist(), dtype=object)
        start_dates = np.array(batch.column("start_date").to_pylist(), dtype=object)
        end_dates = np.array(batch.column("end_date").to_pylist(), dtype=object)
        geometry_blobs = batch.column("geometry").to_pylist()
        area_values = np.array(
            [float(value) if value is not None else np.nan for value in batch.column("area_km2").to_pylist()],
            dtype=float,
        )

        total_rows += batch_rows
        required_mask = np.array(
            [uuid is not None and start_date is not None and blob is not None for uuid, start_date, blob in zip(uuids, start_dates, geometry_blobs, strict=False)],
            dtype=bool,
        )
        if not required_mask.any():
            continue

        source_indices = np.flatnonzero(required_mask)
        source_geometries = shapely.from_wkb([geometry_blobs[index] for index in source_indices])
        source_geometries = repair_batch_geometries(source_geometries)

        non_empty_mask = ~shapely.is_empty(source_geometries)
        if not non_empty_mask.any():
            continue

        source_indices = source_indices[non_empty_mask]
        source_geometries = source_geometries[non_empty_mask]

        bounds = shapely.bounds(source_geometries)
        bbox_mask = (
            (bounds[:, 2] >= district_bbox[0])
            & (bounds[:, 3] >= district_bbox[1])
            & (bounds[:, 0] <= district_bbox[2])
            & (bounds[:, 1] <= district_bbox[3])
        )
        if not bbox_mask.any():
            while total_rows >= next_progress:
                print(
                    {
                        "source_rows_processed": total_rows,
                        "intersecting_events": intersecting_event_count,
                        "district_day_rows": len(daily_metrics["district"]),
                    },
                    flush=True,
                )
                next_progress += PROGRESS_INTERVAL
            continue

        source_indices = source_indices[bbox_mask]
        candidate_geometries = source_geometries[bbox_mask]
        candidate_projected = shapely.transform(candidate_geometries, projector.transform, interleaved=False)
        footprint_area_km2 = area_values[source_indices].copy()
        missing_area_mask = ~np.isfinite(footprint_area_km2)
        if missing_area_mask.any():
            footprint_area_km2[missing_area_mask] = (
                shapely.area(candidate_projected[missing_area_mask]) / 1_000_000
            )

        district_event_positions = np.array([], dtype=int)
        for level in enabled_levels:
            event_positions, _ = aggregate_level(
                level_indexes[level],
                candidate_geometries,
                candidate_projected,
                source_indices,
                start_dates,
                daily_metrics[level],
            )
            if level == "district" and event_positions.size:
                district_event_positions = np.unique(event_positions)

        if district_event_positions.size:
            intersecting_event_count += int(district_event_positions.size)
            build_event_sample(
                event_sample,
                args.event_sample_limit,
                district_event_positions,
                source_indices,
                uuids,
                start_dates,
                end_dates,
                footprint_area_km2,
                candidate_geometries,
            )

        while total_rows >= next_progress:
            print(
                {
                    "source_rows_processed": total_rows,
                    "intersecting_events": intersecting_event_count,
                    "district_day_rows": len(daily_metrics["district"]),
                },
                flush=True,
            )
            next_progress += PROGRESS_INTERVAL

    output_counts: dict[str, dict[str, int]] = {}
    artifacts: dict[str, str | None] = {}
    built_levels: list[str] = []
    for level in enabled_levels:
        daily_count, monthly_count = write_level_outputs(args.processed_dir, level, daily_metrics[level])
        if not daily_count:
            continue
        built_levels.append(level)
        output_counts[level] = {
            "day_rows": daily_count,
            "month_rows": monthly_count,
        }
        artifacts[f"fact_{level}_day"] = f"fact_{level}_day.parquet"
        artifacts[f"fact_{level}_month"] = f"fact_{level}_month.parquet"

    if event_sample:
        write_geoparquet(args.processed_dir / "fact_groundsource_event_sample.geoparquet", event_sample)
        artifacts["fact_groundsource_event_sample"] = "fact_groundsource_event_sample.geoparquet"

    manifest = {
        "generated_at": datetime.now(UTC).isoformat(),
        "status": "ok" if built_levels else "no_intersections_found",
        "groundsource_path": str(args.groundsource_path),
        "source_rows": total_rows,
        "intersecting_events": intersecting_event_count,
        "event_sample_size": len(event_sample),
        "built_levels": built_levels,
        "level_row_counts": output_counts,
        "warnings": warnings,
        "artifacts": artifacts,
    }
    write_json(args.processed_dir / "groundsource_build_manifest.json", manifest)
    print(manifest)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
