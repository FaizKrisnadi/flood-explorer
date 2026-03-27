from __future__ import annotations

import argparse
import csv
import json
import shutil
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"
DEFAULT_REVIEWED_DIR = DEFAULT_PROCESSED_DIR / "qualitative" / "regencies"
DEFAULT_GLOBAL_EVENTS_PATH = DEFAULT_PROCESSED_DIR / "qualitative_events.json"
DEFAULT_GLOBAL_STATES_PATH = DEFAULT_PROCESSED_DIR / "geography_review_states.json"
DEFAULT_REGENCY_DIR = DEFAULT_PROCESSED_DIR / "regencies"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build qualitative JSON assets from reviewed regency qualitative CSV inputs."
    )
    parser.add_argument("--reviewed-dir", type=Path, default=DEFAULT_REVIEWED_DIR)
    parser.add_argument("--global-events-output", type=Path, default=DEFAULT_GLOBAL_EVENTS_PATH)
    parser.add_argument("--global-states-output", type=Path, default=DEFAULT_GLOBAL_STATES_PATH)
    parser.add_argument("--regency-output-dir", type=Path, default=DEFAULT_REGENCY_DIR)
    return parser.parse_args()


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def parse_bool(value: str | None) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "y"}


def normalize_tags(raw: str | None) -> list[str]:
    if not raw:
        return []
    for separator in ("|", ",", ";"):
        raw = raw.replace(separator, "|")
    return [item.strip() for item in raw.split("|") if item.strip()]


def normalize_date(value: str | None, fallback: str = "") -> str:
    text = (value or "").strip()
    if len(text) == 10:
        return text
    if len(text) == 7:
        return f"{text}-01"
    return fallback


def period_bounds(row: dict[str, Any]) -> tuple[str, str]:
    event_date = normalize_date(row.get("event_date"))
    month_seed = event_date[:7] if len(event_date) == 10 else ""
    period_start = normalize_date(row.get("time_window_start"), f"{month_seed}-01" if month_seed else event_date)
    period_end = normalize_date(row.get("time_window_end"), period_start)
    return period_start, period_end


def month_token(value: str) -> str:
    return value[:7] if len(value) >= 7 else ""


def is_publishable_row(row: dict[str, Any]) -> bool:
    review_status = row.get("review_status", "").strip().lower()
    publishable_status = {
        row.get("verification_status", "").strip().lower(),
        row.get("match_confidence", "").strip().lower(),
    }
    published = parse_bool(row.get("published")) or parse_bool(row.get("evidence_scope"))
    return (
        review_status in {"reviewed", "manual_match"}
        and "publishable" in publishable_status
        and published
    )


def supporting_record_payload(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "event_id": row.get("event_id", ""),
        "headline": row.get("headline", ""),
        "claim_type": row.get("claim_type", ""),
        "source_name": row.get("source_name", ""),
        "source_url": row.get("source_url", ""),
        "source_date": normalize_date(row.get("source_date"), normalize_date(row.get("event_date"))),
        "media_type": row.get("media_type", ""),
        "media_url": row.get("media_url", ""),
    }


def event_payload(featured_row: dict[str, Any], supporting_rows: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "event_id": featured_row.get("event_id", ""),
        "event_date": normalize_date(featured_row.get("event_date")),
        "admin_level": featured_row.get("admin_level", "regency"),
        "admin_code": featured_row.get("admin_code", ""),
        "location_label": featured_row.get("location_label", ""),
        "source_name": featured_row.get("source_name", ""),
        "source_url": featured_row.get("source_url", ""),
        "source_date": normalize_date(featured_row.get("source_date"), normalize_date(featured_row.get("event_date"))),
        "headline": featured_row.get("headline", ""),
        "summary": featured_row.get("summary_id") or featured_row.get("summary_en") or "",
        "summary_id": featured_row.get("summary_id", ""),
        "summary_en": featured_row.get("summary_en", ""),
        "media_type": featured_row.get("media_type", ""),
        "media_url": featured_row.get("media_url", ""),
        "claim_type": featured_row.get("claim_type", ""),
        "impact_tags": normalize_tags(featured_row.get("impact_tags")),
        "canonical_event_group": featured_row.get("canonical_event_group", "") or featured_row.get("event_id", ""),
        "period_start": period_bounds(featured_row)[0],
        "period_end": period_bounds(featured_row)[1],
        "supporting_records": [supporting_record_payload(row) for row in supporting_rows],
    }


def regency_slug_from_filename(path: Path) -> str:
    return path.name.replace("_inputs.reviewed.csv", "")


def normalize_row(raw: dict[str, Any]) -> dict[str, Any]:
    row = dict(raw)
    tail = row.get(None)
    if isinstance(tail, list) and tail:
        if not row.get("time_window_start") and len(tail) >= 1:
            row["time_window_start"] = tail[0]
        if not row.get("time_window_end") and len(tail) >= 2:
            row["time_window_end"] = tail[1]
    row.pop(None, None)

    if row.get("match_confidence", "").strip().lower() == "publishable":
        row["verification_status"] = "publishable"
    if row.get("review_status", "").strip().lower() == "manual_match" and row.get("duplicate_group", "").strip().lower() == "reviewed":
        row["review_status"] = "reviewed"
    if not parse_bool(row.get("published")) and parse_bool(row.get("evidence_scope")):
        row["published"] = "true"

    if not normalize_date(row.get("source_date")):
        row["source_date"] = normalize_date(row.get("event_date"))

    claim_type = str(row.get("claim_type", "")).strip()
    source_family = str(row.get("source_family_id", "")).strip()
    if claim_type.startswith("dup-") and source_family:
        row["claim_type"] = source_family

    headline = str(row.get("headline", "")).strip().lower()
    impact_fallback = str(row.get("impact_tags", "")).strip()
    if headline in {"", "news", "report", "artikel"} and impact_fallback and not normalize_date(impact_fallback):
        row["headline"] = impact_fallback

    impact_tags = normalize_tags(row.get("impact_tags"))
    canonical_group = str(row.get("canonical_event_group", "")).strip()
    if not impact_tags and "|" in canonical_group and not canonical_group.startswith("ceg-"):
        row["impact_tags"] = canonical_group

    if not canonical_group or "|" in canonical_group:
        admin = str(row.get("admin_code", "")).replace(".", "-")
        month = month_token(normalize_date(row.get("event_date")))
        event_id = str(row.get("event_id", "event"))
        row["canonical_event_group"] = f"ceg-{admin}-{month}-{event_id}"

    return row


def rows_from_file(path: Path) -> list[dict[str, Any]]:
    with path.open(encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        return [normalize_row(row) for row in reader]


def build_assets(reviewed_dir: Path) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, dict[str, list[dict[str, Any]]]]]:
    global_events: list[dict[str, Any]] = []
    global_states: list[dict[str, Any]] = []
    per_regency: dict[str, dict[str, list[dict[str, Any]]]] = {}

    for reviewed_file in sorted(reviewed_dir.glob("*_inputs.reviewed.csv")):
        slug = regency_slug_from_filename(reviewed_file)
        rows = rows_from_file(reviewed_file)
        if not rows:
            per_regency[slug] = {"events": [], "states": []}
            continue

        grouped_rows: dict[tuple[str, str, str, str], list[dict[str, Any]]] = defaultdict(list)
        review_tracker: dict[tuple[str, str, str], list[dict[str, Any]]] = defaultdict(list)

        for row in rows:
            period_start, period_end = period_bounds(row)
            admin_code = row.get("admin_code", "")
            canonical_group = row.get("canonical_event_group", "") or row.get("event_id", "")
            grouped_rows[(admin_code, period_start, period_end, canonical_group)].append(row)
            review_tracker[(admin_code, period_start, period_end)].append(row)

        regency_events: list[dict[str, Any]] = []
        grouped_events_for_state: dict[tuple[str, str, str], list[dict[str, Any]]] = defaultdict(list)
        for key, grouped in grouped_rows.items():
            publishable_rows = [row for row in grouped if is_publishable_row(row)]
            if not publishable_rows:
                continue
            publishable_rows.sort(
                key=lambda row: (
                    parse_bool(row.get("is_supporting_evidence")),
                    normalize_date(row.get("source_date"), normalize_date(row.get("event_date"))),
                    normalize_date(row.get("event_date")),
                    row.get("event_id", ""),
                ),
            )
            featured = publishable_rows[0]
            supporting = publishable_rows[1:]
            payload = event_payload(featured, supporting)
            regency_events.append(payload)
            grouped_events_for_state[key[:3]].append(payload)

        regency_events.sort(key=lambda item: (item.get("event_date", ""), item.get("event_id", "")), reverse=True)

        regency_states: list[dict[str, Any]] = []
        for period_key, period_rows in sorted(review_tracker.items()):
            admin_code, period_start, period_end = period_key
            publishable_events = sorted(
                grouped_events_for_state.get(period_key, []),
                key=lambda item: (item.get("event_date", ""), item.get("event_id", "")),
                reverse=True,
            )

            additional_count = 0
            if publishable_events:
                additional_count += max(0, len(publishable_events) - 1)
                additional_count += sum(len(item.get("supporting_records", [])) for item in publishable_events)
                public_state = "has_featured_report_and_more" if additional_count > 0 else "has_featured_report_only"
                featured_event_id = publishable_events[0].get("event_id", "")
            else:
                has_reviewed_status = any(
                    row.get("review_status", "").strip().lower() == "reviewed" for row in period_rows
                )
                public_state = "reviewed_but_no_publishable_report" if has_reviewed_status else "not_reviewed_yet"
                featured_event_id = ""

            admin_level = period_rows[0].get("admin_level", "regency")
            province_code = admin_code.split(".")[0] if admin_code else ""
            regency_states.append(
                {
                    "geography_period_id": f"{admin_code}:{month_token(period_start)}",
                    "admin_level": admin_level,
                    "admin_code": admin_code,
                    "province_code": province_code,
                    "period_start": period_start,
                    "period_end": period_end,
                    "public_state": public_state,
                    "featured_event_id": featured_event_id,
                    "supporting_event_count": additional_count,
                    "review_status_rollup": "reviewed",
                    "reviewed_at": datetime.now(UTC).isoformat(),
                }
            )

        regency_states.sort(key=lambda item: (item.get("period_start", ""), item.get("admin_code", "")), reverse=True)
        per_regency[slug] = {"events": regency_events, "states": regency_states}
        global_events.extend(regency_events)
        global_states.extend(regency_states)

    global_events.sort(key=lambda item: (item.get("event_date", ""), item.get("admin_code", "")), reverse=True)
    global_states.sort(key=lambda item: (item.get("period_start", ""), item.get("admin_code", "")), reverse=True)
    return global_events, global_states, per_regency


def main() -> int:
    args = parse_args()
    if not args.reviewed_dir.exists():
        raise FileNotFoundError(f"Reviewed regency directory not found: {args.reviewed_dir}")

    global_events, global_states, per_regency = build_assets(args.reviewed_dir)

    write_json(args.global_events_output, global_events)
    write_json(args.global_states_output, global_states)

    if args.regency_output_dir.exists():
        shutil.rmtree(args.regency_output_dir)
    args.regency_output_dir.mkdir(parents=True, exist_ok=True)

    for slug, payload in per_regency.items():
        write_json(args.regency_output_dir / f"{slug}_qualitative_events.json", payload["events"])
        write_json(args.regency_output_dir / f"{slug}_geography_review_states.json", payload["states"])

    print(
        json.dumps(
            {
                "reviewed_source_dir": str(args.reviewed_dir),
                "global_events": len(global_events),
                "global_states": len(global_states),
                "regency_bundle_count": len(per_regency),
                "regency_output_dir": str(args.regency_output_dir),
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
