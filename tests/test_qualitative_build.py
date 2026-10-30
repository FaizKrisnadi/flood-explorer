from __future__ import annotations

import csv
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1] / "scripts"))

from build_qualitative_from_reviewed import build_assets  # noqa: E402

CSV_COLUMNS = [
    "review_status",
    "verification_status",
    "published",
    "event_id",
    "event_date",
    "source_date",
    "admin_level",
    "admin_code",
    "location_label",
    "source_name",
    "source_url",
    "headline",
    "summary_id",
    "summary_en",
    "media_type",
    "media_url",
    "claim_type",
    "impact_tags",
    "canonical_event_group",
    "time_window_start",
    "time_window_end",
    "is_supporting_evidence",
]


def reviewed_csv(slug: str, rows: list[dict]) -> dict[str, str]:
    filename = f"{slug}_inputs.reviewed.csv"
    buffer = []
    for row in rows:
        buffer.append({column: row.get(column, "") for column in CSV_COLUMNS})
    return {filename: buffer}


def write_reviewed_dir(directory: Path, files: dict[str, list[dict]]) -> None:
    for filename, rows in files.items():
        with (directory / filename).open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=CSV_COLUMNS)
            writer.writeheader()
            writer.writerows(rows)


def base_row(slug_event: str, admin_code: str, event_date: str, source_url: str) -> dict:
    return {
        "review_status": "reviewed",
        "verification_status": "publishable",
        "published": "true",
        "event_id": slug_event,
        "event_date": event_date,
        "source_date": event_date,
        "admin_level": "regency",
        "admin_code": admin_code,
        "location_label": "Kota Uji",
        "source_name": "Sumber Uji",
        "source_url": source_url,
        "headline": "Banjir uji melanda kota",
        "summary_id": "Ringkasan banjir uji.",
        "summary_en": "Test flood summary.",
        "media_type": "article",
        "claim_type": "evacuation",
        "impact_tags": "evacuation|flooding",
        "canonical_event_group": f"ceg-{admin_code}-2026-01",
    }


class QualitativeBuildPublicationEligibilityTest(unittest.TestCase):
    def test_placeholder_only_regency_keeps_records_but_reports_no_publishable_report(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            reviewed_dir = Path(temp_dir)
            write_reviewed_dir(
                reviewed_dir,
                reviewed_csv(
                    "aceh__kota_uji",
                    [base_row("ev-placeholder", "11.01", "2026-01-15", "https://example.com/story")],
                ),
            )
            global_events, global_states, per_regency = build_assets(reviewed_dir)

            # Evidence is preserved: the reviewed record stays in the events payload.
            self.assertEqual(len(global_events), 1)
            self.assertEqual(global_events[0]["source_url"], "https://example.com/story")
            self.assertEqual(len(per_regency["aceh__kota_uji"]["events"]), 1)

            states = [state for state in global_states if state["admin_code"] == "11.01"]
            self.assertEqual(len(states), 1)
            self.assertEqual(states[0]["public_state"], "reviewed_but_no_publishable_report")
            self.assertEqual(states[0]["featured_event_id"], "")

    def test_eligible_record_anchors_group_over_older_placeholder(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            reviewed_dir = Path(temp_dir)
            write_reviewed_dir(
                reviewed_dir,
                reviewed_csv(
                    "aceh__kota_uji_dua",
                    [
                        # Older placeholder: the legacy builder would have featured it.
                        base_row("ev-placeholder", "11.02", "2026-01-05", "https://example.com/older"),
                        base_row("ev-real", "11.02", "2026-01-10", "https://aceh.antaranews.com/berita/banjir"),
                    ],
                ),
            )
            global_events, global_states, _ = build_assets(reviewed_dir)

            self.assertEqual(len(global_events), 1)
            event = global_events[0]
            self.assertEqual(event["event_id"], "ev-real")
            self.assertEqual(
                [record["event_id"] for record in event["supporting_records"]],
                ["ev-placeholder"],
            )

            states = [state for state in global_states if state["admin_code"] == "11.02"]
            self.assertEqual(states[0]["public_state"], "has_featured_report_only")
            self.assertEqual(states[0]["featured_event_id"], "ev-real")
            self.assertEqual(states[0]["supporting_event_count"], 0)

    def test_all_eligible_group_keeps_legacy_counts(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            reviewed_dir = Path(temp_dir)
            write_reviewed_dir(
                reviewed_dir,
                reviewed_csv(
                    "aceh__kota_uji_tiga",
                    [
                        base_row("ev-a", "11.03", "2026-01-05", "https://aceh.antaranews.com/berita/satu"),
                        base_row("ev-b", "11.03", "2026-01-10", "https://aceh.antaranews.com/berita/dua"),
                    ],
                ),
            )
            global_events, global_states, _ = build_assets(reviewed_dir)

            # Both records share a canonical group, so they merge into one
            # event payload with the later record as its supporting record.
            self.assertEqual(len(global_events), 1)
            featured = global_events[0]
            self.assertEqual(featured["event_id"], "ev-a")
            self.assertEqual(
                [record["event_id"] for record in featured["supporting_records"]],
                ["ev-b"],
            )

            states = [state for state in global_states if state["admin_code"] == "11.03"]
            self.assertEqual(states[0]["public_state"], "has_featured_report_and_more")
            self.assertEqual(states[0]["featured_event_id"], "ev-a")
            self.assertEqual(states[0]["supporting_event_count"], 1)


if __name__ == "__main__":
    unittest.main()
