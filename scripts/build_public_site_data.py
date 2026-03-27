from __future__ import annotations

import argparse
import json
import shutil
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path

import pyarrow.parquet as pq

from build_regency_qualitative_index import build_regency_index
from pipeline_utils import read_geoparquet_rows, write_json


PROJECT_ROOT = Path(__file__).resolve().parents[1]
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"
SITE_DIR = PROJECT_ROOT / "site" / "data" / "latest"
LEVELS = ("province", "regency", "district", "village")
PUBLIC_SITE_LEVELS = ("province", "regency", "district")
METRICS = (
    "unique_event_count",
    "flood_days",
    "sum_intersection_area_km2",
    "max_coverage_ratio",
)
QUALITATIVE_SUPPORTED_LEVELS = ("province", "regency", "district")
QUALITATIVE_ROUTE_VERSION = "qualitative-v1"
QUALITATIVE_GLOBAL_EVENTS_FILE = "qualitative_events.json"
QUALITATIVE_GLOBAL_STATES_FILE = "geography_review_states.json"
QUALITATIVE_REGENCY_DIR = "regencies"

FREE_BASEMAPS = {
    "map": {
        "label_key": "view.map",
        "kind": "style_url",
        "best_effort": False,
        "style_url": "https://tiles.openfreemap.org/styles/positron",
        "attribution_html": 'OpenFreeMap &copy; <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    },
    "imagery": {
        "label_key": "view.imagery",
        "kind": "style_object",
        "best_effort": True,
        "fallback_message_key": "status.imagery_fallback",
        "style": {
            "version": 8,
            "sources": {
                "imagery": {
                    "type": "raster",
                    "tiles": [
                        "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    ],
                    "tileSize": 256,
                    "attribution": "Source: Esri, Maxar, Earthstar Geographics, and the GIS community",
                }
            },
            "layers": [
                {
                    "id": "imagery-background",
                    "type": "background",
                    "paint": {"background-color": "#d8e3ec"},
                },
                {
                    "id": "imagery-base",
                    "type": "raster",
                    "source": "imagery",
                    "paint": {
                        "raster-saturation": -0.18,
                        "raster-contrast": 0.08,
                        "raster-brightness-min": 0.1,
                        "raster-brightness-max": 0.95,
                    },
                },
            ],
        },
        "attribution_html": "Source: Esri, Maxar, Earthstar Geographics, and the GIS community",
    },
    "hybrid": {
        "label_key": "view.hybrid",
        "kind": "style_object",
        "best_effort": True,
        "fallback_message_key": "status.imagery_fallback",
        "style": {
            "version": 8,
            "sources": {
                "imagery": {
                    "type": "raster",
                    "tiles": [
                        "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    ],
                    "tileSize": 256,
                    "attribution": "Source: Esri, Maxar, Earthstar Geographics, and the GIS community",
                },
                "reference": {
                    "type": "raster",
                    "tiles": [
                        "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                    ],
                    "tileSize": 256,
                    "attribution": "Reference labels: Esri",
                },
            },
            "layers": [
                {
                    "id": "hybrid-background",
                    "type": "background",
                    "paint": {"background-color": "#d8e3ec"},
                },
                {
                    "id": "hybrid-imagery",
                    "type": "raster",
                    "source": "imagery",
                    "paint": {
                        "raster-saturation": -0.12,
                        "raster-contrast": 0.1,
                        "raster-brightness-min": 0.1,
                        "raster-brightness-max": 0.95,
                    },
                },
                {
                    "id": "hybrid-reference",
                    "type": "raster",
                    "source": "reference",
                    "paint": {"raster-opacity": 0.92},
                },
            ],
        },
        "attribution_html": "Imagery: Esri, Maxar, Earthstar Geographics, and the GIS community. Reference labels: Esri",
    },
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build static JSON assets for flood-explorer.")
    parser.add_argument("--processed-dir", type=Path, default=PROCESSED_DIR)
    parser.add_argument("--site-dir", type=Path, default=SITE_DIR)
    parser.add_argument("--dataset-version", default=datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ"))
    parser.add_argument("--geometry-simplify", type=float, default=0.001)
    return parser.parse_args()


def simplify_geometry(geometry, tolerance: float):
    if tolerance <= 0:
        return geometry
    simplified = geometry.simplify(tolerance, preserve_topology=True)
    return simplified if not simplified.is_empty else geometry


def write_boundary_geojson(path: Path, rows: list[dict], tolerance: float) -> None:
    from shapely.geometry import mapping

    features = []
    for row in rows:
        geometry = simplify_geometry(row["geometry"], tolerance)
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "code": row["code"],
                    "name": row["name"],
                    "level": row["level"],
                    "province_code": row["province_code"],
                    "regency_code": row["regency_code"],
                    "district_code": row["district_code"],
                    "village_code": row["village_code"],
                    "boundary_source": row.get("boundary_source"),
                },
                "geometry": mapping(geometry),
            }
        )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )


def copy_compact_geojson(src: Path, dest: Path) -> None:
    data = json.loads(src.read_text(encoding="utf-8"))
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def reset_public_site_data(site_dir: Path) -> None:
    for relative_dir in ("boundaries", "metrics"):
        target = site_dir / relative_dir
        if target.exists():
            shutil.rmtree(target)

    for relative_file in ("build_manifest.json", "coverage_report.json", "search_index.json", "methodology.json"):
        target = site_dir / relative_file
        if target.exists():
            target.unlink()


def build_search_index(admin_rows: list[dict], public_levels: list[str]) -> list[dict]:
    public_level_set = set(public_levels)
    return sorted(
        [
            {
                "code": row["code"],
                "name": row["name"],
                "level": row["level"],
                "province_code": row["province_code"],
                "regency_code": row["regency_code"],
                "district_code": row["district_code"],
                "village_code": row["village_code"],
            }
            for row in admin_rows
            if row["level"] in public_level_set
        ],
        key=lambda item: (LEVELS.index(item["level"]), item["name"]),
    )


def month_range(start_month: str, end_month: str) -> list[str]:
    months = []
    cursor = f"{start_month}-01"
    limit = f"{end_month}-01"
    while cursor <= limit:
        months.append(cursor[:7])
        year, month = cursor[:7].split("-")
        next_year = int(year)
        next_month = int(month) + 1
        if next_month == 13:
            next_month = 1
            next_year += 1
        cursor = f"{next_year:04d}-{next_month:02d}-01"
    return months


def write_metric_shards(site_dir: Path, level: str, month_rows: list[dict]) -> dict:
    by_month: dict[str, list[dict]] = defaultdict(list)
    by_code: dict[str, list[dict]] = defaultdict(list)
    by_bundle: dict[str, list[dict]] = defaultdict(list)
    summary: dict[str, dict] = {}
    geo_key = f"{level}_code"
    for row in month_rows:
        month = row["month_start"][:7]
        compact = {
            "code": row[geo_key],
            "month_start": row["month_start"],
            "unique_event_count": row["unique_event_count"],
            "flood_days": row["flood_days"],
            "sum_intersection_area_km2": row["sum_intersection_area_km2"],
            "max_coverage_ratio": row["max_coverage_ratio"],
        }
        by_month[month].append(compact)
        by_code[row[geo_key]].append(compact)
        if level == "district":
            bundle_key = ".".join(row[geo_key].split(".")[:2])
            by_bundle[bundle_key].append(compact)

        bucket = summary.setdefault(
            row[geo_key],
            {"code": row[geo_key], "unique_event_count": 0, "flood_days": 0, "sum_intersection_area_km2": 0.0, "max_coverage_ratio": 0.0},
        )
        bucket["unique_event_count"] += row["unique_event_count"]
        bucket["flood_days"] += row["flood_days"]
        bucket["sum_intersection_area_km2"] += row["sum_intersection_area_km2"]
        bucket["max_coverage_ratio"] = max(bucket["max_coverage_ratio"], row["max_coverage_ratio"])

    metrics_root = site_dir / "metrics" / level / "month"
    trend_root = site_dir / "metrics" / level / "trend"
    observed_months = sorted(by_month)
    for month in month_range(observed_months[0], observed_months[-1]):
        write_json(metrics_root / f"{month}.json", by_month.get(month, []))

    trend_bundle_segments = None
    if level == "district":
        trend_bundle_segments = 2
        for bundle_key, rows in by_bundle.items():
            rows.sort(key=lambda item: (item["code"], item["month_start"]))
            write_json(trend_root / f"{bundle_key}.json", rows)
    else:
        for code, rows in by_code.items():
            rows.sort(key=lambda item: item["month_start"])
            write_json(trend_root / f"{code}.json", rows)

    summary_rows = sorted(summary.values(), key=lambda item: item["code"])
    write_json(site_dir / "metrics" / level / "summary_all_time.json", summary_rows)
    assets = {
        "summary_all_time": f"metrics/{level}/summary_all_time.json",
        "month_dir": f"metrics/{level}/month",
        "trend_dir": f"metrics/{level}/trend",
        "months": observed_months,
    }
    if trend_bundle_segments:
        assets["trend_bundle_segments"] = trend_bundle_segments
    return assets


def copy_or_write_json(src: Path | None, dest: Path, default_payload) -> None:
    if src and src.exists():
        write_json(dest, json.loads(src.read_text(encoding="utf-8")))
        return
    if dest.exists():
        return
    write_json(dest, default_payload)


def sync_qualitative_assets(processed_dir: Path, site_dir: Path) -> dict:
    copy_or_write_json(processed_dir / QUALITATIVE_GLOBAL_EVENTS_FILE, site_dir / QUALITATIVE_GLOBAL_EVENTS_FILE, [])
    copy_or_write_json(processed_dir / QUALITATIVE_GLOBAL_STATES_FILE, site_dir / QUALITATIVE_GLOBAL_STATES_FILE, [])

    site_regency_dir = site_dir / QUALITATIVE_REGENCY_DIR
    processed_regency_dir = processed_dir / QUALITATIVE_REGENCY_DIR
    if processed_regency_dir.exists():
        if site_regency_dir.exists():
            shutil.rmtree(site_regency_dir)
        shutil.copytree(processed_regency_dir, site_regency_dir)
    site_regency_dir.mkdir(parents=True, exist_ok=True)
    write_json(site_regency_dir / "index.json", build_regency_index(site_regency_dir, site_dir))

    return {
        "global_events_path": QUALITATIVE_GLOBAL_EVENTS_FILE,
        "global_states_path": QUALITATIVE_GLOBAL_STATES_FILE,
        "regency_index_path": f"{QUALITATIVE_REGENCY_DIR}/index.json",
        "regency_assets_base_path": QUALITATIVE_REGENCY_DIR,
        "supported_levels": list(QUALITATIVE_SUPPORTED_LEVELS),
        "route_version": QUALITATIVE_ROUTE_VERSION,
    }


def main() -> int:
    args = parse_args()
    args.site_dir.mkdir(parents=True, exist_ok=True)
    reset_public_site_data(args.site_dir)

    admin_rows = pq.read_table(args.processed_dir / "dim_admin_unit.parquet").to_pylist()
    coverage_report = json.loads((args.processed_dir / "coverage_report.json").read_text(encoding="utf-8"))
    groundsource_manifest_path = args.processed_dir / "groundsource_build_manifest.json"
    groundsource_manifest = (
        json.loads(groundsource_manifest_path.read_text(encoding="utf-8"))
        if groundsource_manifest_path.exists()
        else {"status": "missing_groundsource_source", "artifacts": {}}
    )

    boundary_rows_by_level = {}
    for level in PUBLIC_SITE_LEVELS:
        boundary_geojson_path = args.processed_dir / f"dim_boundary_{level}.geojson"
        if boundary_geojson_path.exists():
            boundary_rows_by_level[level] = boundary_geojson_path
            continue

        boundary_path = args.processed_dir / f"dim_boundary_{level}.geoparquet"
        if boundary_path.exists():
            boundary_rows_by_level[level] = read_geoparquet_rows(boundary_path)

    metric_assets = {}
    for level in LEVELS:
        month_path = args.processed_dir / f"fact_{level}_month.parquet"
        if not month_path.exists():
            continue
        month_rows = pq.read_table(month_path).to_pylist()
        metric_assets[level] = write_metric_shards(args.site_dir, level, month_rows)

    available_levels = [level for level in PUBLIC_SITE_LEVELS if level in boundary_rows_by_level and level in metric_assets]

    boundary_assets = {}
    for level in available_levels:
        rel_path = f"boundaries/{level}.geojson"
        boundary_source = boundary_rows_by_level[level]
        if isinstance(boundary_source, Path):
            copy_compact_geojson(boundary_source, args.site_dir / rel_path)
        else:
            write_boundary_geojson(args.site_dir / rel_path, boundary_source, args.geometry_simplify)
        boundary_assets[level] = rel_path

    search_index = build_search_index(admin_rows, available_levels)
    write_json(args.site_dir / "search_index.json", search_index)
    write_json(args.site_dir / "coverage_report.json", coverage_report)

    methodology = {
        "sources": [
            "Groundsource flood footprints from Zenodo",
            "Kemendagri-style admin hierarchy from cahyadsn/wilayah",
            "Postal codes from cahyadsn/wilayah_kodepos",
            "Boundaries from downloaded reference SQL, with higher levels derived when raw layers are missing",
        ],
        "notes": [
            "method.note.release_gate",
            "method.note.village_optional",
            "method.note.prebuilt_assets",
            "method.note.disclaimer",
        ],
        "metrics": {
            "unique_event_count": "Count of intersecting Groundsource events.",
            "flood_days": "Number of day buckets with at least one intersecting event.",
            "sum_intersection_area_km2": "Summed intersection area across matched events in square kilometers.",
            "max_coverage_ratio": "Largest observed share of a geography covered by a single event in the selected period.",
        },
    }
    write_json(args.site_dir / "methodology.json", methodology)
    qualitative_manifest = sync_qualitative_assets(args.processed_dir, args.site_dir)

    manifest = {
        "dataset_version": args.dataset_version,
        "generated_at": datetime.now(UTC).isoformat(),
        "default_level": "province",
        "default_metric": "unique_event_count",
        "default_language": "id",
        "default_basemap_mode": "map",
        "available_levels": available_levels,
        "boundary_assets": boundary_assets,
        "metrics": METRICS,
        "metric_assets": metric_assets,
        "basemap_modes": FREE_BASEMAPS,
        "imagery_available": True,
        "coverage_report": "coverage_report.json",
        "search_index": "search_index.json",
        "methodology": "methodology.json",
        "qualitative": qualitative_manifest,
        "groundsource_status": groundsource_manifest.get("status", "unknown"),
        "groundsource_summary": {
            "intersecting_events": groundsource_manifest.get("intersecting_events"),
            "built_levels": groundsource_manifest.get("built_levels", []),
            "event_sample_size": groundsource_manifest.get("event_sample_size"),
        },
        "warning_codes": [code for code in [coverage_report["release_gate"].get("warning_code")] if code],
    }
    write_json(args.site_dir / "build_manifest.json", manifest)
    print(manifest)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
