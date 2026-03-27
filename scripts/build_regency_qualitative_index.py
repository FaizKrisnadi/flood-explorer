from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SITE_DIR = PROJECT_ROOT / "site" / "data" / "latest"
DEFAULT_REGENCY_DIR = SITE_DIR / "regencies"
EVENT_SUFFIX = "_qualitative_events.json"
STATE_SUFFIX = "_geography_review_states.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the qualitative regency asset index.")
    parser.add_argument("--regency-dir", type=Path, default=DEFAULT_REGENCY_DIR)
    parser.add_argument("--site-dir", type=Path, default=SITE_DIR)
    parser.add_argument("--output", type=Path, default=DEFAULT_REGENCY_DIR / "index.json")
    return parser.parse_args()


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def payload_rows(payload: Any, list_key: str) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [row for row in payload if isinstance(row, dict)]
    if isinstance(payload, dict) and isinstance(payload.get(list_key), list):
        return [row for row in payload[list_key] if isinstance(row, dict)]
    return []


def first_value(rows: list[dict[str, Any]], *keys: str) -> Any:
    for row in rows:
        for key in keys:
            value = row.get(key)
            if value not in {None, ""}:
                return value
    return None


def summarize_public_states(rows: list[dict[str, Any]]) -> dict[str, int]:
    summary: dict[str, int] = {}
    for row in rows:
        state = row.get("public_state")
        if not state:
            continue
        summary[state] = summary.get(state, 0) + 1
    return summary


def build_regency_index(regency_dir: Path, site_dir: Path) -> list[dict[str, Any]]:
    if not regency_dir.exists():
        return []

    event_files = {path.name[: -len(EVENT_SUFFIX)]: path for path in regency_dir.glob(f"*{EVENT_SUFFIX}")}
    state_files = {path.name[: -len(STATE_SUFFIX)]: path for path in regency_dir.glob(f"*{STATE_SUFFIX}")}

    rows: list[dict[str, Any]] = []
    for slug in sorted(set(event_files) & set(state_files)):
        events_path = event_files[slug]
        states_path = state_files[slug]
        event_rows = payload_rows(load_json(events_path), "events")
        state_rows = payload_rows(load_json(states_path), "states")

        admin_code = first_value(state_rows, "admin_code", "code") or first_value(event_rows, "admin_code", "code")
        admin_level = first_value(state_rows, "admin_level", "level") or first_value(event_rows, "admin_level", "level") or "regency"
        province_code = (
            first_value(state_rows, "province_code")
            or first_value(event_rows, "province_code")
            or (str(admin_code).split(".")[0] if admin_code else None)
        )

        updated_at = datetime.fromtimestamp(
            max(events_path.stat().st_mtime, states_path.stat().st_mtime),
            tz=UTC,
        ).isoformat()

        rows.append(
            {
                "admin_code": admin_code,
                "admin_level": admin_level,
                "province_code": province_code,
                "slug": slug,
                "events_path": str(events_path.relative_to(site_dir)),
                "states_path": str(states_path.relative_to(site_dir)),
                "updated_at": updated_at,
                "public_state_summary": summarize_public_states(state_rows),
            }
        )

    return rows


def main() -> int:
    args = parse_args()
    args.regency_dir.mkdir(parents=True, exist_ok=True)
    write_json(args.output, build_regency_index(args.regency_dir, args.site_dir))
    print(args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
