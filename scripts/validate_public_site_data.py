from __future__ import annotations

import json
import re
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SITE_DATA_DIR = PROJECT_ROOT / "site" / "data" / "latest"
PUBLIC_LEVELS = ("province", "regency", "district")
METRICS = (
    "unique_event_count",
    "flood_days",
    "sum_intersection_area_km2",
    "max_coverage_ratio",
)
SEARCH_INDEX_KEYS = {"code", "name", "level", "province_code", "regency_code", "district_code", "village_code"}
GEOJSON_PROPERTY_KEYS = {
    "code",
    "name",
    "level",
    "province_code",
    "regency_code",
    "district_code",
    "village_code",
    "boundary_source",
}
SUMMARY_KEYS = {"code", "unique_event_count", "flood_days", "sum_intersection_area_km2", "max_coverage_ratio"}
TIME_SERIES_KEYS = SUMMARY_KEYS | {"month_start"}
MONTH_PATTERN = re.compile(r"^\d{4}-\d{2}$")
QUALITATIVE_SUPPORTED_LEVELS = ("province", "regency", "district")
QUALITATIVE_PUBLIC_STATES = {
    "not_reviewed_yet",
    "reviewed_but_no_publishable_report",
    "has_featured_report_only",
    "has_featured_report_and_more",
}
QUALITATIVE_MANIFEST_KEYS = {
    "global_events_path",
    "global_states_path",
    "regency_index_path",
    "regency_assets_base_path",
    "supported_levels",
    "route_version",
}
QUALITATIVE_INDEX_KEYS = {
    "admin_code",
    "admin_level",
    "province_code",
    "slug",
    "events_path",
    "states_path",
}
QUALITATIVE_EVENT_KEYS = {"admin_code", "admin_level", "source_name", "source_date", "summary"}
QUALITATIVE_STATE_KEYS = {"admin_code", "admin_level", "public_state"}


def load_json(path: Path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def validate_public_site_data(site_dir: Path) -> list[str]:
    errors: list[str] = []
    expected_root_files = {
        "build_manifest.json",
        "coverage_report.json",
        "methodology.json",
        "search_index.json",
    }
    for filename in expected_root_files:
        if not (site_dir / filename).exists():
            errors.append(f"Missing required file: {filename}")

    if errors:
        return errors

    manifest = load_json(site_dir / "build_manifest.json")
    coverage_report = load_json(site_dir / "coverage_report.json")
    methodology = load_json(site_dir / "methodology.json")
    search_index = load_json(site_dir / "search_index.json")

    errors.extend(validate_manifest(manifest))
    errors.extend(validate_coverage_report(coverage_report))
    errors.extend(validate_methodology(methodology, manifest))
    errors.extend(validate_search_index(search_index))
    errors.extend(validate_boundary_assets(manifest, site_dir))
    errors.extend(validate_metric_assets(manifest, site_dir))
    errors.extend(validate_qualitative_assets(manifest, site_dir))
    return errors


def validate_manifest(manifest: dict) -> list[str]:
    errors: list[str] = []
    required_keys = {
        "dataset_version",
        "generated_at",
        "default_level",
        "default_metric",
        "default_language",
        "default_basemap_mode",
        "available_levels",
        "boundary_assets",
        "metrics",
        "metric_assets",
        "basemap_modes",
        "imagery_available",
        "coverage_report",
        "search_index",
        "methodology",
        "qualitative",
        "groundsource_status",
        "groundsource_summary",
        "warning_codes",
    }
    missing = sorted(required_keys - set(manifest))
    if missing:
        errors.append(f"build_manifest.json is missing keys: {', '.join(missing)}")
        return errors

    if manifest["available_levels"] != list(PUBLIC_LEVELS):
        errors.append("available_levels must be ['province', 'regency', 'district'].")
    if manifest["metrics"] != list(METRICS):
        errors.append("metrics must match the published metric contract.")
    if manifest["default_level"] not in PUBLIC_LEVELS:
        errors.append("default_level must be one of the published levels.")
    if manifest["default_metric"] not in METRICS:
        errors.append("default_metric must be one of the published metrics.")
    if manifest["coverage_report"] != "coverage_report.json":
        errors.append("coverage_report path must point to coverage_report.json.")
    if manifest["search_index"] != "search_index.json":
        errors.append("search_index path must point to search_index.json.")
    if manifest["methodology"] != "methodology.json":
        errors.append("methodology path must point to methodology.json.")
    qualitative = manifest["qualitative"]
    if not isinstance(qualitative, dict):
        errors.append("qualitative must be an object.")
    else:
        missing_qualitative = sorted(QUALITATIVE_MANIFEST_KEYS - set(qualitative))
        if missing_qualitative:
            errors.append(f"qualitative is missing keys: {', '.join(missing_qualitative)}")
        if qualitative.get("supported_levels") != list(QUALITATIVE_SUPPORTED_LEVELS):
            errors.append("qualitative.supported_levels must match province, regency, and district.")
        if not isinstance(qualitative.get("route_version"), str) or not qualitative["route_version"]:
            errors.append("qualitative.route_version must be a non-empty string.")
    if not isinstance(manifest["warning_codes"], list):
        errors.append("warning_codes must be a list.")
    if manifest["groundsource_status"] not in {"ok", "missing_groundsource_source"}:
        errors.append("groundsource_status must be 'ok' or 'missing_groundsource_source'.")
    groundsource_summary = manifest["groundsource_summary"]
    if not isinstance(groundsource_summary, dict):
        errors.append("groundsource_summary must be an object.")
    elif manifest["groundsource_status"] == "ok":
        built_levels = groundsource_summary.get("built_levels")
        if built_levels != list(PUBLIC_LEVELS):
            errors.append("groundsource_summary.built_levels must match published levels when status is ok.")
    return errors


def qualitative_rows(payload, list_key: str) -> list[dict] | None:
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict) and isinstance(payload.get(list_key), list):
        return payload[list_key]
    return None


def normalize_regency_index(payload) -> list[dict] | None:
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        rows = []
        for slug, row in payload.items():
            if not isinstance(row, dict):
                return None
            normalized = dict(row)
            normalized.setdefault("slug", slug)
            rows.append(normalized)
        return rows
    return None


def validate_qualitative_assets(manifest: dict, site_dir: Path) -> list[str]:
    errors: list[str] = []
    qualitative = manifest["qualitative"]
    if not isinstance(qualitative, dict):
        return ["qualitative must be an object."]
    if not QUALITATIVE_MANIFEST_KEYS.issubset(set(qualitative)):
        return errors

    events_path = site_dir / qualitative["global_events_path"]
    states_path = site_dir / qualitative["global_states_path"]
    regency_index_path = site_dir / qualitative["regency_index_path"]

    for label, path, list_key, required_keys in (
        ("global qualitative events", events_path, "events", QUALITATIVE_EVENT_KEYS),
        ("global review states", states_path, "states", QUALITATIVE_STATE_KEYS),
    ):
        if not path.exists():
            errors.append(f"Missing {label} asset: {path.relative_to(site_dir)}")
            continue
        rows = qualitative_rows(load_json(path), list_key)
        if rows is None:
            errors.append(f"{path.relative_to(site_dir)} must contain a list or a `{list_key}` list.")
            continue
        if rows and not required_keys.issubset(set(rows[0])):
            errors.append(f"{path.relative_to(site_dir)} is missing required qualitative fields.")

    if not regency_index_path.exists():
        errors.append(f"Missing regency qualitative index: {regency_index_path.relative_to(site_dir)}")
        return errors

    regency_index = normalize_regency_index(load_json(regency_index_path))
    if regency_index is None:
        errors.append(f"{regency_index_path.relative_to(site_dir)} must contain a list of rows or a legacy row map.")
        return errors

    seen_admin_codes: set[str] = set()
    seen_slugs: set[str] = set()
    for row in regency_index:
        missing = sorted(QUALITATIVE_INDEX_KEYS - set(row))
        if missing:
            errors.append(
                f"{regency_index_path.relative_to(site_dir)} row is missing keys: {', '.join(missing)}"
            )
            continue
        admin_code = row["admin_code"]
        slug = row["slug"]
        if admin_code in seen_admin_codes:
            errors.append(f"Duplicate regency qualitative index entry for admin_code `{admin_code}`.")
        if slug in seen_slugs:
            errors.append(f"Duplicate regency qualitative index entry for slug `{slug}`.")
        seen_admin_codes.add(admin_code)
        seen_slugs.add(slug)

        if row["admin_level"] != "regency":
            errors.append(f"Regency qualitative index row `{slug}` must use admin_level `regency`.")
        if not str(admin_code).startswith(str(row["province_code"])):
            errors.append(f"Regency qualitative index row `{slug}` has a mismatched province_code.")

        for payload_label, relative_path, list_key, required_keys in (
            ("events", row["events_path"], "events", QUALITATIVE_EVENT_KEYS),
            ("states", row["states_path"], "states", QUALITATIVE_STATE_KEYS),
        ):
            payload_path = site_dir / relative_path
            if not payload_path.exists():
                errors.append(
                    f"Regency qualitative index row `{slug}` points to missing {payload_label} file: {relative_path}"
                )
                continue
            payload_rows = qualitative_rows(load_json(payload_path), list_key)
            if payload_rows is None:
                errors.append(f"{relative_path} must contain a list or a `{list_key}` list.")
                continue
            if payload_rows and not required_keys.issubset(set(payload_rows[0])):
                errors.append(f"{relative_path} is missing required qualitative fields.")
            if payload_label == "states":
                invalid_states = sorted(
                    {item.get("public_state") for item in payload_rows if item.get("public_state") not in QUALITATIVE_PUBLIC_STATES}
                )
                if invalid_states:
                    errors.append(
                        f"{relative_path} contains unsupported public_state values: {', '.join(str(state) for state in invalid_states)}"
                    )
    return errors


def validate_coverage_report(coverage_report: dict) -> list[str]:
    errors: list[str] = []
    required_keys = {"generated_at", "release_gate", "overall", "by_province"}
    missing = sorted(required_keys - set(coverage_report))
    if missing:
        errors.append(f"coverage_report.json is missing keys: {', '.join(missing)}")
        return errors
    release_gate = coverage_report["release_gate"]
    if not isinstance(release_gate.get("district_threshold"), (int, float)):
        errors.append("coverage_report.release_gate.district_threshold must be numeric.")
    if not isinstance(release_gate.get("district_release_ready"), bool):
        errors.append("coverage_report.release_gate.district_release_ready must be boolean.")
    overall = coverage_report["overall"]
    if sorted(overall.keys()) != ["district", "province", "regency", "village"]:
        errors.append("coverage_report.overall must include province, regency, district, and village.")
    if not isinstance(coverage_report["by_province"], dict) or not coverage_report["by_province"]:
        errors.append("coverage_report.by_province must be a non-empty object.")
    return errors


def validate_methodology(methodology: dict, manifest: dict) -> list[str]:
    errors: list[str] = []
    required_keys = {"sources", "notes", "metrics"}
    missing = sorted(required_keys - set(methodology))
    if missing:
        errors.append(f"methodology.json is missing keys: {', '.join(missing)}")
        return errors
    if sorted(methodology["metrics"].keys()) != sorted(manifest["metrics"]):
        errors.append("methodology metrics must match the build manifest metric list.")
    if not methodology["sources"] or not methodology["notes"]:
        errors.append("methodology sources and notes must be non-empty.")
    return errors


def validate_search_index(search_index: list[dict]) -> list[str]:
    errors: list[str] = []
    if not isinstance(search_index, list) or not search_index:
        return ["search_index.json must contain a non-empty list."]
    sample = search_index[0]
    if set(sample) != SEARCH_INDEX_KEYS:
        errors.append("search_index rows must use the published search key contract.")
    invalid_levels = sorted({row.get("level") for row in search_index if row.get("level") not in PUBLIC_LEVELS})
    if invalid_levels:
        errors.append(f"search_index contains unsupported levels: {', '.join(invalid_levels)}")
    return errors


def validate_boundary_assets(manifest: dict, site_dir: Path) -> list[str]:
    errors: list[str] = []
    boundary_assets = manifest["boundary_assets"]
    if sorted(boundary_assets.keys()) != sorted(PUBLIC_LEVELS):
        errors.append("boundary_assets must be defined for province, regency, and district.")
        return errors
    for level, relative_path in boundary_assets.items():
        path = site_dir / relative_path
        if not path.exists():
            errors.append(f"Missing boundary asset for {level}: {relative_path}")
            continue
        geojson = load_json(path)
        if geojson.get("type") != "FeatureCollection":
            errors.append(f"{relative_path} must be a GeoJSON FeatureCollection.")
            continue
        features = geojson.get("features", [])
        if not features:
            errors.append(f"{relative_path} must contain at least one feature.")
            continue
        properties = features[0].get("properties", {})
        if not GEOJSON_PROPERTY_KEYS.issubset(set(properties)):
            errors.append(f"{relative_path} is missing required boundary properties.")
    return errors


def validate_metric_assets(manifest: dict, site_dir: Path) -> list[str]:
    errors: list[str] = []
    metric_assets = manifest["metric_assets"]
    if sorted(metric_assets.keys()) != sorted(PUBLIC_LEVELS):
        errors.append("metric_assets must be defined for province, regency, and district.")
        return errors
    for level, config in metric_assets.items():
        summary_path = site_dir / config["summary_all_time"]
        month_dir = site_dir / config["month_dir"]
        trend_dir = site_dir / config["trend_dir"]
        months = config.get("months", [])
        if not summary_path.exists():
            errors.append(f"Missing summary asset for {level}: {summary_path.relative_to(site_dir)}")
        else:
            summary = load_json(summary_path)
            if not isinstance(summary, list):
                errors.append(f"{summary_path.relative_to(site_dir)} must contain a list.")
            elif summary and set(summary[0]) != SUMMARY_KEYS:
                errors.append(f"{summary_path.relative_to(site_dir)} rows must match the summary metric contract.")
        if not month_dir.is_dir():
            errors.append(f"Missing month directory for {level}: {month_dir.relative_to(site_dir)}")
        if not trend_dir.is_dir():
            errors.append(f"Missing trend directory for {level}: {trend_dir.relative_to(site_dir)}")
        if not months:
            errors.append(f"Metric asset months list is empty for {level}.")
            continue
        if months != sorted(set(months)):
            errors.append(f"Metric asset months must be sorted and unique for {level}.")
        for month in months:
            if not MONTH_PATTERN.match(month):
                errors.append(f"Invalid month token for {level}: {month}")
                continue
            month_path = month_dir / f"{month}.json"
            if not month_path.exists():
                errors.append(f"Missing monthly metric shard for {level}: {month_path.relative_to(site_dir)}")
        if trend_dir.is_dir() and not any(trend_dir.glob("*.json")):
            errors.append(f"Trend directory for {level} must contain JSON shards.")
        else:
            sample_months = sorted({months[0], months[-1]})
            for month in sample_months:
                month_path = month_dir / f"{month}.json"
                if not month_path.exists():
                    continue
                month_payload = load_json(month_path)
                if not isinstance(month_payload, list):
                    errors.append(f"{month_path.relative_to(site_dir)} must contain a list.")
                elif month_payload and set(month_payload[0]) != TIME_SERIES_KEYS:
                    errors.append(f"{month_path.relative_to(site_dir)} rows must match the time-series metric contract.")
            sample_trend_path = sorted(trend_dir.glob("*.json"))[0]
            trend_payload = load_json(sample_trend_path)
            if not isinstance(trend_payload, list):
                errors.append(f"{sample_trend_path.relative_to(site_dir)} must contain a list.")
            elif trend_payload and set(trend_payload[0]) != TIME_SERIES_KEYS:
                errors.append(f"{sample_trend_path.relative_to(site_dir)} rows must match the time-series metric contract.")
    return errors


def main() -> int:
    errors = validate_public_site_data(SITE_DATA_DIR)
    if errors:
        print("Public site data validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1
    print("Public site data validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
