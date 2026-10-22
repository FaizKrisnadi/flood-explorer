from __future__ import annotations
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import URLError
sys.path.append(str(Path(__file__).resolve().parents[1] / "scripts"))
from check_groundsource_release import inspect_metadata, run_check, resolve_latest


def fixture():
    return {"id": 18647054, "modified": "2026-03-12T00:00:00Z", "metadata": {"version": "1", "publication_date": "2026-02-15"}, "files": [{"key": "groundsource_2026.parquet", "checksum": "md5:cd1b5de6508f7aad8e1d1d0dd4cecea6", "size": 667100000}], "links": {"latest": "https://zenodo.org/api/records/18647054"}}


class GroundsourceReleaseCheckTest(unittest.TestCase):
    def test_extracts_pinned_file_metadata_and_relation(self):
        result = inspect_metadata(fixture())
        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["file"]["checksum"], fixture()["files"][0]["checksum"])
        self.assertIsNone(result["latest_relation_matches_pin"])

    def test_mismatched_record_and_newer_relation(self):
        metadata = fixture()
        metadata["id"] = 999
        metadata["links"]["latest"] = "https://zenodo.org/api/records/999"
        result = inspect_metadata(metadata)
        self.assertIn("record_id_mismatch", result["errors"])
        self.assertIsNone(result["latest_relation_matches_pin"])

    def test_latest_resolver_is_not_mistaken_for_a_new_record(self):
        metadata = fixture()
        metadata["links"]["latest"] = "https://zenodo.org/api/records/18647054/versions/latest"
        self.assertIsNone(inspect_metadata(metadata)["latest_relation_matches_pin"])

    def test_missing_fields_are_explicit(self):
        result = inspect_metadata({})
        self.assertEqual(result["status"], "invalid_metadata")
        self.assertIn("missing_pinned_file", result["errors"])
        self.assertIn("missing_modified", result["errors"])
        self.assertIsNone(result["latest_relation_matches_pin"])

    def test_network_failure_is_reported_without_live_request(self):
        with patch("check_groundsource_release.fetch_metadata", side_effect=URLError("offline")):
            result = run_check()
        self.assertEqual(result["status"], "check_failed")
        self.assertIn("offline", result["errors"][0])

    def test_fixture_input_never_uses_network(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "metadata.json"
            source.write_text(json.dumps(fixture()))
            with patch("check_groundsource_release.fetch_metadata", side_effect=AssertionError("must not request network")):
                result = run_check(source)
            self.assertEqual(result["status"], "ok")
            self.assertEqual(source.read_text(), json.dumps(fixture()))

    def test_latest_resolution_compares_returned_id(self):
        metadata = fixture()
        metadata["id"] = 999
        with patch("check_groundsource_release.fetch_metadata", return_value=metadata) as fetch:
            result = resolve_latest({"latest_relation": "https://zenodo.org/api/records/18647054/versions/latest"})
        self.assertFalse(result["matches_pin"])
        self.assertEqual(result["record_id"], "999")
        fetch.assert_called_once()

    def test_latest_resolution_rejects_untrusted_urls_before_request(self):
        for url in ["https://evil.com/api/records/1", "https://zenodo.org/api/records/1/files/data/content", "http://zenodo.org/api/records/1", "https://zenodo.org@evil.com/api/records/1"]:
            with patch("check_groundsource_release.fetch_metadata") as fetch:
                with self.assertRaises(ValueError):
                    resolve_latest({"latest_relation": url})
                fetch.assert_not_called()
