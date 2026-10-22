from __future__ import annotations
import json
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[1] / "scripts"))
from audit_report_sources import audit, record_errors, source_url_error


class ReportSourceAuditTest(unittest.TestCase):
    def test_rejects_placeholder_homepage_and_malformed_urls(self):
        for url in [None, "", "https://example.com/story", "https://sub.example.org/story", "https://publisher.co.id/", "https://publisher.co.id/news", "javascript:alert(1)", "https://publisher.co.id/bad url", "https://user:pass@publisher.co.id/story", "https://publisher.co.id:bad/story"]:
            with self.subTest(url=url):
                self.assertIsNotNone(source_url_error(url))

    def test_accepts_direct_article_links(self):
        for url in ["https://publisher.co.id/berita/2026/01/12/banjir", "https://publisher.com/article?id=42", "https://publisher.id/flood-update.html"]:
            self.assertIsNone(source_url_error(url))

    def test_invalid_nested_support_rejects_whole_record(self):
        record = {"source_url": "https://publisher.id/real-story", "supporting_records": [{"source_url": "https://publisher.id/another-story", "supporting_records": [{"source_url": "https://example.com/fake"}]}]}
        errors = record_errors(record)
        self.assertEqual(errors[0]["reason"], "placeholder_source_url")
        self.assertEqual(errors[0]["record_path"], "record.supporting_records[0].supporting_records[0]")
        self.assertTrue(record_errors({"source_url": "https://publisher.id/story", "supporting_records": {}}))

    def test_audit_preserves_input_and_counts_root_and_bundles(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "regencies").mkdir()
            good = '[{"event_id":"a","source_url":"https://publisher.id/article"}]'
            bad = '[{"event_id":"b","source_url":"https://example.com/article"}]'
            (root / "qualitative_events.json").write_text(good)
            bundle = root / "regencies/x_qualitative_events.json"
            bundle.write_text(bad)
            result = audit(root)
            self.assertEqual((result["files"], result["records"], result["eligible_records"], result["withheld_records"]), (2, 2, 1, 1))
            self.assertEqual(bundle.read_text(), bad)
