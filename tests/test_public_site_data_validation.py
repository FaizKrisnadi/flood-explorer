from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1] / "scripts"))

from validate_public_site_data import validate_public_site_data, validate_public_site_data_report  # noqa: E402


class PublicSiteDataValidationTest(unittest.TestCase):
    def test_validate_public_site_data_accepts_minimal_valid_fixture(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            site_dir = Path(temp_dir)
            self._write_fixture(site_dir)
            self.assertEqual(validate_public_site_data(site_dir), [])

    def test_validate_public_site_data_flags_missing_month_file(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            site_dir = Path(temp_dir)
            self._write_fixture(site_dir)
            (site_dir / "metrics" / "province" / "month" / "2024-01.json").unlink()
            errors = validate_public_site_data(site_dir)
            self.assertTrue(any("Missing monthly metric shard" in error for error in errors))

    def test_validate_public_site_data_flags_missing_qualitative_asset(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            site_dir = Path(temp_dir)
            self._write_fixture(site_dir)
            (site_dir / "regencies" / "aceh__kota_banda_aceh_qualitative_events.json").unlink()
            errors = validate_public_site_data(site_dir)
            self.assertTrue(any("points to missing events file" in error for error in errors))

    def test_validate_public_site_data_flags_duplicate_regency_index_rows(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            site_dir = Path(temp_dir)
            self._write_fixture(site_dir)
            payload = json.loads((site_dir / "regencies" / "index.json").read_text(encoding="utf-8"))
            payload.append(dict(payload[0]))
            (site_dir / "regencies" / "index.json").write_text(json.dumps(payload), encoding="utf-8")
            errors = validate_public_site_data(site_dir)
            self.assertTrue(any("Duplicate regency qualitative index entry" in error for error in errors))

    def test_validate_public_site_data_passes_consistent_summary_and_month_rollup(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            site_dir = Path(temp_dir)
            self._write_fixture(site_dir)
            self._write_json(
                site_dir / "metrics" / "province" / "month" / "2024-01.json",
                [
                    {
                        "code": "11",
                        "month_start": "2024-01-01",
                        "unique_event_count": 2,
                        "flood_days": 1,
                        "sum_intersection_area_km2": 3.5,
                        "max_coverage_ratio": 0.25,
                    }
                ],
            )
            self._write_json(
                site_dir / "metrics" / "province" / "summary_all_time.json",
                [
                    {
                        "code": "11",
                        "unique_event_count": 2,
                        "flood_days": 1,
                        "sum_intersection_area_km2": 3.5,
                        "max_coverage_ratio": 0.25,
                    }
                ],
            )
            self.assertEqual(validate_public_site_data(site_dir), [])

    def test_validate_public_site_data_flags_summary_month_mismatch(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            site_dir = Path(temp_dir)
            self._write_fixture(site_dir)
            self._write_json(
                site_dir / "metrics" / "province" / "month" / "2024-01.json",
                [
                    {
                        "code": "11",
                        "month_start": "2024-01-01",
                        "unique_event_count": 7,
                        "flood_days": 1,
                        "sum_intersection_area_km2": 3.5,
                        "max_coverage_ratio": 0.25,
                    }
                ],
            )
            self._write_json(
                site_dir / "metrics" / "province" / "summary_all_time.json",
                [
                    {
                        "code": "11",
                        "unique_event_count": 2,
                        "flood_days": 1,
                        "sum_intersection_area_km2": 3.5,
                        "max_coverage_ratio": 0.25,
                    }
                ],
            )
            errors = validate_public_site_data(site_dir)
            self.assertTrue(
                any("summary_all_time.json disagrees with month shards for `11`" in error for error in errors)
            )

    def test_validate_public_site_data_flags_unlisted_month_shard_with_records(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            site_dir = Path(temp_dir)
            self._write_fixture(site_dir)
            self._write_json(
                site_dir / "metrics" / "province" / "month" / "2024-02.json",
                [
                    {
                        "code": "11",
                        "month_start": "2024-02-01",
                        "unique_event_count": 1,
                        "flood_days": 1,
                        "sum_intersection_area_km2": 1.0,
                        "max_coverage_ratio": 0.1,
                    }
                ],
            )
            errors = validate_public_site_data(site_dir)
            self.assertTrue(
                any(
                    "Month shard 2024-02.json for province contains records but is not listed" in error
                    for error in errors
                )
            )

    def test_validate_public_site_data_flags_unknown_featured_event(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            site_dir = Path(temp_dir)
            self._write_fixture(site_dir)
            self._write_json(
                site_dir / "regencies" / "aceh__kota_banda_aceh_geography_review_states.json",
                [
                    {
                        "admin_code": "11.71",
                        "admin_level": "regency",
                        "public_state": "has_featured_report_only",
                        "featured_event_id": "ghost-event",
                    }
                ],
            )
            errors = validate_public_site_data(site_dir)
            self.assertTrue(any("reference unknown featured event `ghost-event`" in error for error in errors))

    def test_validate_public_site_data_warns_on_placeholder_featured_event(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            site_dir = Path(temp_dir)
            self._write_fixture(site_dir)
            self._write_json(
                site_dir / "regencies" / "aceh__kota_banda_aceh_qualitative_events.json",
                [
                    {
                        "admin_code": "11.71",
                        "admin_level": "regency",
                        "event_id": "ev-1",
                        "source_name": "Fixture Source",
                        "source_date": "2024-01-01",
                        "source_url": "https://example.com/story",
                        "summary": "Fixture summary",
                    }
                ],
            )
            self._write_json(
                site_dir / "regencies" / "aceh__kota_banda_aceh_geography_review_states.json",
                [
                    {
                        "admin_code": "11.71",
                        "admin_level": "regency",
                        "public_state": "has_featured_report_only",
                        "featured_event_id": "ev-1",
                    }
                ],
            )
            errors, warnings = validate_public_site_data_report(site_dir)
            self.assertEqual(errors, [])
            self.assertTrue(
                any("source link is not publishable (placeholder_source_url)" in warning for warning in warnings)
            )

    def _write_fixture(self, site_dir: Path) -> None:
        (site_dir / "boundaries").mkdir(parents=True)
        for level in ("province", "regency", "district"):
            (site_dir / "metrics" / level / "month").mkdir(parents=True)
            (site_dir / "metrics" / level / "trend").mkdir(parents=True)
            self._write_json(
                site_dir / "boundaries" / f"{level}.geojson",
                {
                    "type": "FeatureCollection",
                    "features": [
                        {
                            "type": "Feature",
                            "properties": {
                                "code": "11",
                                "name": "Aceh",
                                "level": level,
                                "province_code": "11",
                                "regency_code": None,
                                "district_code": None,
                                "village_code": None,
                                "boundary_source": "fixture",
                            },
                            "geometry": {"type": "Polygon", "coordinates": []},
                        }
                    ],
                },
            )
            self._write_json(site_dir / "metrics" / level / "summary_all_time.json", [])
            self._write_json(site_dir / "metrics" / level / "month" / "2024-01.json", [])
            self._write_json(site_dir / "metrics" / level / "trend" / "11.json", [])

        self._write_json(
            site_dir / "build_manifest.json",
            {
                "dataset_version": "20240101T000000Z",
                "generated_at": "2024-01-01T00:00:00Z",
                "default_level": "province",
                "default_metric": "unique_event_count",
                "default_language": "en",
                "default_basemap_mode": "map",
                "available_levels": ["province", "regency", "district"],
                "boundary_assets": {
                    "province": "boundaries/province.geojson",
                    "regency": "boundaries/regency.geojson",
                    "district": "boundaries/district.geojson",
                },
                "metrics": [
                    "unique_event_count",
                    "flood_days",
                    "sum_intersection_area_km2",
                    "max_coverage_ratio",
                ],
                "metric_assets": {
                    level: {
                        "summary_all_time": f"metrics/{level}/summary_all_time.json",
                        "month_dir": f"metrics/{level}/month",
                        "trend_dir": f"metrics/{level}/trend",
                        "months": ["2024-01"],
                    }
                    for level in ("province", "regency", "district")
                },
                "basemap_modes": {"map": {"label_key": "view.map"}},
                "imagery_available": True,
                "coverage_report": "coverage_report.json",
                "search_index": "search_index.json",
                "methodology": "methodology.json",
                "qualitative": {
                    "global_events_path": "qualitative_events.json",
                    "global_states_path": "geography_review_states.json",
                    "regency_index_path": "regencies/index.json",
                    "regency_assets_base_path": "regencies",
                    "supported_levels": ["province", "regency", "district"],
                    "route_version": "qualitative-v1",
                },
                "groundsource_status": "ok",
                "groundsource_summary": {
                    "intersecting_events": 1,
                    "built_levels": ["province", "regency", "district"],
                    "event_sample_size": 1,
                },
                "warning_codes": [],
            },
        )
        self._write_json(
            site_dir / "coverage_report.json",
            {
                "generated_at": "2024-01-01T00:00:00Z",
                "release_gate": {
                    "district_threshold": 0.98,
                    "warning_code": None,
                    "district_release_ready": True,
                },
                "overall": {
                    "province": {},
                    "regency": {},
                    "district": {},
                    "village": {},
                },
                "by_province": {"11": {}},
            },
        )
        self._write_json(
            site_dir / "methodology.json",
            {
                "sources": ["fixture"],
                "notes": ["fixture.note"],
                "metrics": {
                    "unique_event_count": "Fixture",
                    "flood_days": "Fixture",
                    "sum_intersection_area_km2": "Fixture",
                    "max_coverage_ratio": "Fixture",
                },
            },
        )
        self._write_json(
            site_dir / "search_index.json",
            [
                {
                    "code": "11",
                    "name": "Aceh",
                    "level": "province",
                    "province_code": "11",
                    "regency_code": None,
                    "district_code": None,
                    "village_code": None,
                }
            ],
        )
        self._write_json(site_dir / "qualitative_events.json", [])
        self._write_json(site_dir / "geography_review_states.json", [])
        self._write_json(
            site_dir / "regencies" / "aceh__kota_banda_aceh_qualitative_events.json",
            [
                {
                    "admin_code": "11.71",
                    "admin_level": "regency",
                    "source_name": "Fixture Source",
                    "source_date": "2024-01-01",
                    "summary": "Fixture summary",
                }
            ],
        )
        self._write_json(
            site_dir / "regencies" / "aceh__kota_banda_aceh_geography_review_states.json",
            [
                {
                    "admin_code": "11.71",
                    "admin_level": "regency",
                    "public_state": "has_featured_report_only",
                }
            ],
        )
        self._write_json(
            site_dir / "regencies" / "index.json",
            [
                {
                    "admin_code": "11.71",
                    "admin_level": "regency",
                    "province_code": "11",
                    "slug": "aceh__kota_banda_aceh",
                    "events_path": "regencies/aceh__kota_banda_aceh_qualitative_events.json",
                    "states_path": "regencies/aceh__kota_banda_aceh_geography_review_states.json",
                    "updated_at": "2024-01-01T00:00:00+00:00",
                    "public_state_summary": {"has_featured_report_only": 1},
                }
            ],
        )

    def _write_json(self, path: Path, payload) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload), encoding="utf-8")


if __name__ == "__main__":
    unittest.main()
