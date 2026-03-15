from __future__ import annotations

import argparse
from collections import Counter
from collections.abc import Iterable
from datetime import UTC, datetime
from pathlib import Path

from pipeline_utils import (
    classify_code,
    dissolve_geometries,
    load_admin_rows,
    load_boundary_rows,
    load_postal_rows,
    parent_code_for_level,
    write_geojson,
    write_geoparquet,
    write_json,
    write_tabular_parquet,
)


PROJECT_ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = PROJECT_ROOT / "data" / "raw" / "reference"
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"

LEVELS = ("province", "regency", "district", "village")
BOUNDARY_DIRS = {"province": "prov", "regency": "kab", "district": "kec", "village": "kel"}
RELEASE_DISTRICT_THRESHOLD = 0.98


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build canonical Indonesian reference tables and multi-level boundary artifacts."
    )
    parser.add_argument("--raw-dir", type=Path, default=RAW_DIR)
    parser.add_argument("--processed-dir", type=Path, default=PROCESSED_DIR)
    return parser.parse_args()


def load_boundary_hierarchy(raw_dir: Path) -> dict[str, list[dict]]:
    return {
        level: load_boundary_rows(raw_dir, BOUNDARY_DIRS[level], level)
        for level in LEVELS
    }


def enrich_boundary_rows(
    rows: Iterable[dict],
    admin_by_code: dict[str, dict],
    postal_by_village: dict[str, str],
) -> list[dict]:
    enriched = []
    for row in rows:
        admin = admin_by_code.get(row["code"])
        if not admin:
            continue
        enriched_row = {
            "code": row["code"],
            "name": admin["name"],
            "level": admin["level"],
            "province_code": admin["province_code"],
            "regency_code": admin["regency_code"],
            "district_code": admin["district_code"],
            "village_code": admin["village_code"],
            "postal_code": postal_by_village.get(admin["code"]) if admin["level"] == "village" else None,
            "centroid_lat": row.get("centroid_lat"),
            "centroid_lng": row.get("centroid_lng"),
            "geometry": row["geometry"],
            "boundary_source": row.get("boundary_source", "raw"),
        }
        enriched.append(enriched_row)
    return enriched


def derive_level_rows(
    target_level: str,
    source_rows: list[dict],
    admin_by_code: dict[str, dict],
    postal_by_village: dict[str, str],
) -> list[dict]:
    from shapely.geometry import MultiPolygon, Polygon

    grouped_geometry = dissolve_geometries(source_rows, by=f"{target_level}_code")
    derived_rows = []
    for code, geometry in grouped_geometry.items():
        admin = admin_by_code.get(code)
        if not admin:
            continue
        if isinstance(geometry, Polygon):
            geometry = MultiPolygon([geometry])
        point = geometry.representative_point()
        derived_rows.append(
            {
                "code": code,
                "name": admin["name"],
                "level": target_level,
                "province_code": admin["province_code"],
                "regency_code": admin["regency_code"],
                "district_code": admin["district_code"],
                "village_code": admin["village_code"],
                "postal_code": postal_by_village.get(code) if target_level == "village" else None,
                "centroid_lat": point.y,
                "centroid_lng": point.x,
                "geometry": geometry,
                "boundary_source": "derived",
            }
        )
    return sorted(derived_rows, key=lambda item: item["code"])


def choose_level_rows(
    target_level: str,
    raw_rows: list[dict],
    lower_rows: list[dict] | None,
    admin_by_code: dict[str, dict],
    postal_by_village: dict[str, str],
) -> list[dict]:
    if raw_rows:
        return sorted(raw_rows, key=lambda item: item["code"])
    if lower_rows:
        return derive_level_rows(target_level, lower_rows, admin_by_code, postal_by_village)
    return []


def build_coverage_report(admin_rows: list[dict], boundary_rows: dict[str, list[dict]]) -> dict:
    totals_by_level = Counter(row["level"] for row in admin_rows)
    totals_by_level_and_province = Counter((row["level"], row["province_code"]) for row in admin_rows)

    report = {
        "generated_at": datetime.now(UTC).isoformat(),
        "release_gate": {
            "district_threshold": RELEASE_DISTRICT_THRESHOLD,
            "warning_code": None,
        },
        "overall": {},
        "by_province": {},
    }

    for level in LEVELS:
        boundary_codes = {row["code"] for row in boundary_rows[level]}
        report["overall"][level] = {
            "admin_total": totals_by_level[level],
            "boundary_total": len(boundary_codes),
            "coverage_ratio": round(len(boundary_codes) / totals_by_level[level], 6) if totals_by_level[level] else 0,
            "boundary_source_mix": Counter(row["boundary_source"] for row in boundary_rows[level]),
        }

    province_codes = sorted({row["province_code"] for row in admin_rows if row["province_code"]})
    for province_code in province_codes:
        level_report = {}
        for level in LEVELS:
            province_boundary_codes = {
                row["code"]
                for row in boundary_rows[level]
                if row.get("province_code") == province_code
            }
            admin_total = totals_by_level_and_province[(level, province_code)]
            level_report[level] = {
                "admin_total": admin_total,
                "boundary_total": len(province_boundary_codes),
                "coverage_ratio": round(len(province_boundary_codes) / admin_total, 6) if admin_total else 0,
            }
        report["by_province"][province_code] = level_report

    district_ratio = report["overall"]["district"]["coverage_ratio"]
    required_levels = all(report["overall"][level]["boundary_total"] > 0 for level in ("province", "regency", "district"))
    report["release_gate"]["district_release_ready"] = district_ratio >= RELEASE_DISTRICT_THRESHOLD and required_levels
    if not required_levels:
        report["release_gate"]["warning_code"] = "missing_required_levels"
    elif district_ratio < RELEASE_DISTRICT_THRESHOLD:
        report["release_gate"]["warning_code"] = "district_threshold_not_met"
    return report


def build_manifest(coverage_report: dict, boundary_rows: dict[str, list[dict]]) -> dict:
    return {
        "dataset": "indonesia_reference",
        "generated_at": coverage_report["generated_at"],
        "available_levels": [level for level in LEVELS if boundary_rows[level]],
        "release_gate": coverage_report["release_gate"],
        "artifacts": {
            "dim_admin_unit": "dim_admin_unit.parquet",
            "bridge_village_postal_code": "bridge_village_postal_code.parquet",
            **{
                f"dim_boundary_{level}": {
                    "parquet": f"dim_boundary_{level}.geoparquet",
                    "geojson": f"dim_boundary_{level}.geojson",
                }
                for level in LEVELS
                if boundary_rows[level]
            },
            "coverage_report": "coverage_report.json",
        },
    }


def main() -> int:
    args = parse_args()
    admin_rows = load_admin_rows(args.raw_dir)
    postal_rows = load_postal_rows(args.raw_dir)
    admin_by_code = {row["code"]: row for row in admin_rows}
    postal_by_village = {row["village_code"]: row["postal_code"] for row in postal_rows}

    raw_boundaries = load_boundary_hierarchy(args.raw_dir)
    enriched_raw = {
        level: enrich_boundary_rows(raw_boundaries[level], admin_by_code, postal_by_village)
        for level in LEVELS
    }

    chosen_rows: dict[str, list[dict]] = {}
    chosen_rows["village"] = choose_level_rows("village", enriched_raw["village"], None, admin_by_code, postal_by_village)
    chosen_rows["district"] = choose_level_rows(
        "district", enriched_raw["district"], chosen_rows["village"], admin_by_code, postal_by_village
    )
    chosen_rows["regency"] = choose_level_rows(
        "regency",
        enriched_raw["regency"],
        chosen_rows["district"] or chosen_rows["village"],
        admin_by_code,
        postal_by_village,
    )
    chosen_rows["province"] = choose_level_rows(
        "province",
        enriched_raw["province"],
        chosen_rows["regency"] or chosen_rows["district"] or chosen_rows["village"],
        admin_by_code,
        postal_by_village,
    )

    args.processed_dir.mkdir(parents=True, exist_ok=True)
    write_tabular_parquet(args.processed_dir / "dim_admin_unit.parquet", admin_rows)
    write_tabular_parquet(args.processed_dir / "bridge_village_postal_code.parquet", postal_rows)

    for level in LEVELS:
        if not chosen_rows[level]:
            continue
        write_geoparquet(args.processed_dir / f"dim_boundary_{level}.geoparquet", chosen_rows[level])
        write_geojson(args.processed_dir / f"dim_boundary_{level}.geojson", chosen_rows[level])

    coverage_report = build_coverage_report(admin_rows, chosen_rows)
    write_json(args.processed_dir / "coverage_report.json", coverage_report)

    reference_summary = {
        "admin_units": len(admin_rows),
        "postal_rows": len(postal_rows),
        **{f"{level}_boundaries": len(chosen_rows[level]) for level in LEVELS},
        "district_release_ready": coverage_report["release_gate"]["district_release_ready"],
    }
    write_json(args.processed_dir / "reference_summary.json", reference_summary)
    write_json(args.processed_dir / "reference_build_manifest.json", build_manifest(coverage_report, chosen_rows))
    print(reference_summary)
    print(f"saved {args.processed_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
