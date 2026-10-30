from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1] / "scripts"))

from build_public_site_data import sync_qualitative_assets  # noqa: E402


def write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def write_processed_inputs(processed_dir: Path) -> None:
    write_json(processed_dir / "qualitative_events.json", [{"event_id": "ev-1"}])
    write_json(processed_dir / "geography_review_states.json", [{"admin_code": "11.01"}])
    write_json(
        processed_dir / "regencies" / "aceh__kota_uji_qualitative_events.json",
        [{"admin_code": "11.01", "admin_level": "regency"}],
    )
    write_json(
        processed_dir / "regencies" / "aceh__kota_uji_geography_review_states.json",
        [{"admin_code": "11.01", "admin_level": "regency", "public_state": "not_reviewed_yet"}],
    )


class QualitativeAssetSyncTest(unittest.TestCase):
    def test_processed_inputs_replace_site_assets_without_carryover(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            processed_dir = root / "processed"
            site_dir = root / "site"
            write_processed_inputs(processed_dir)
            manifest = sync_qualitative_assets(processed_dir, site_dir)
            self.assertNotIn("carryover_from_previous_release", manifest)
            self.assertEqual(
                json.loads((site_dir / "qualitative_events.json").read_text(encoding="utf-8")),
                [{"event_id": "ev-1"}],
            )
            index = json.loads((site_dir / "regencies" / "index.json").read_text(encoding="utf-8"))
            self.assertEqual([row["slug"] for row in index], ["aceh__kota_uji"])

    def test_missing_processed_inputs_keep_prior_release_files_and_flag_carryover(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            processed_dir = root / "processed"
            site_dir = root / "site"
            prior_events = [{"event_id": "prior-release-event"}]
            write_json(site_dir / "qualitative_events.json", prior_events)
            write_json(site_dir / "geography_review_states.json", [])
            write_json(
                site_dir / "regencies" / "aceh__kota_lama_qualitative_events.json",
                [{"admin_code": "11.99", "admin_level": "regency"}],
            )
            write_json(
                site_dir / "regencies" / "aceh__kota_lama_geography_review_states.json",
                [{"admin_code": "11.99", "admin_level": "regency", "public_state": "not_reviewed_yet"}],
            )

            manifest = sync_qualitative_assets(processed_dir, site_dir)

            # Prior-release evidence is kept, never deleted, and the manifest says so.
            self.assertEqual(
                json.loads((site_dir / "qualitative_events.json").read_text(encoding="utf-8")),
                prior_events,
            )
            self.assertEqual(
                manifest["carryover_from_previous_release"],
                ["qualitative_events.json", "geography_review_states.json", "regencies/"],
            )
            index = json.loads((site_dir / "regencies" / "index.json").read_text(encoding="utf-8"))
            self.assertEqual([row["slug"] for row in index], ["aceh__kota_lama"])

    def test_partial_processed_inputs_flag_only_the_missing_asset(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            processed_dir = root / "processed"
            site_dir = root / "site"
            write_json(processed_dir / "qualitative_events.json", [{"event_id": "ev-2"}])
            write_json(site_dir / "geography_review_states.json", [{"admin_code": "11.01"}])

            manifest = sync_qualitative_assets(processed_dir, site_dir)

            self.assertEqual(
                json.loads((site_dir / "qualitative_events.json").read_text(encoding="utf-8")),
                [{"event_id": "ev-2"}],
            )
            self.assertEqual(
                manifest["carryover_from_previous_release"],
                ["geography_review_states.json"],
            )


if __name__ == "__main__":
    unittest.main()
