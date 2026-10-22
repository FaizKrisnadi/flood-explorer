"""Audit source-link eligibility without changing qualitative data.

Passing is URL screening only, never evidence of editorial verification.
"""
from __future__ import annotations

import argparse
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
PLACEHOLDER_HOSTS = {"example.com", "example.org", "example.net", "localhost"}
GENERIC_PATHS = {"", "index.html", "index.htm", "index.php", "home", "news", "berita", "en", "id"}


def source_url_error(value: object) -> str | None:
    if not isinstance(value, str) or not value.strip():
        return "missing_source_url"
    if any(c.isspace() for c in value):
        return "malformed_source_url"
    try:
        parsed = urlsplit(value)
        host = (parsed.hostname or "").lower()
        port = parsed.port
    except ValueError:
        return "malformed_source_url"
    if parsed.scheme not in {"https", "http"} or "." not in host or parsed.username or parsed.password:
        return "malformed_source_url"
    if any(host == blocked or host.endswith("." + blocked) for blocked in PLACEHOLDER_HOSTS):
        return "placeholder_source_url"
    if parsed.path.strip("/").lower() in GENERIC_PATHS:
        return "generic_source_url"
    return None


def record_errors(record: object, path: str = "record") -> list[dict]:
    if not isinstance(record, dict):
        return [{"record_path": path, "reason": "malformed_record"}]
    errors = []
    reason = source_url_error(record.get("source_url"))
    if reason:
        errors.append({"record_path": path, "reason": reason, "source_url": record.get("source_url")})
    supporting = record.get("supporting_records", [])
    if not isinstance(supporting, list):
        errors.append({"record_path": path + ".supporting_records", "reason": "malformed_supporting_records"})
    else:
        for index, child in enumerate(supporting):
            errors.extend(record_errors(child, f"{path}.supporting_records[{index}]"))
    return errors


def audit(data_dir: Path) -> dict:
    files = [data_dir / "qualitative_events.json", *sorted((data_dir / "regencies").glob("*_qualitative_events.json"))]
    issues = []
    record_count = withheld = 0
    for file in files:
        records = json.loads(file.read_text(encoding="utf-8"))
        if not isinstance(records, list):
            raise ValueError(f"Expected array: {file}")
        for index, record in enumerate(records):
            record_count += 1
            errors = record_errors(record, f"records[{index}]")
            withheld += bool(errors)
            for error in errors:
                issues.append({"file": str(file.relative_to(data_dir)), "event_id": record.get("event_id") if isinstance(record, dict) else None, **error})
    return {"checked_at": datetime.now(timezone.utc).isoformat(), "scope": "URL eligibility; does not verify article contents or availability", "files": len(files), "records": record_count, "eligible_records": record_count - withheld, "withheld_records": withheld, "reason_counts": dict(Counter(i["reason"] for i in issues)), "issues": issues}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=ROOT / "site/data/latest")
    parser.add_argument("--output", type=Path, help="Optional JSON audit report")
    parser.add_argument("--strict", action="store_true", help="Exit nonzero if any record fails screening")
    args = parser.parse_args()
    report = audit(args.data_dir)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in report.items() if k != "issues"}, indent=2))
    return int(args.strict and report["withheld_records"] > 0)


if __name__ == "__main__":
    raise SystemExit(main())
