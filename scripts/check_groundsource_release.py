"""Read-only metadata check for the pinned Groundsource Zenodo release.

Does not download the dataset or change the pin, manifest or public assets.
"""
from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener

PINNED_RECORD_ID = "18647054"
PINNED_FILE = "groundsource_2026.parquet"
API_URL = f"https://zenodo.org/api/records/{PINNED_RECORD_ID}"


def validate_api_url(url: str) -> None:
    if not isinstance(url, str) or not re.fullmatch(r"https://zenodo\.org/api/records/[0-9]+(?:/versions/latest)?/?", url):
        raise ValueError("Latest relation must be an official Zenodo record API URL")


class ZenodoRedirectHandler(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        validate_api_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def fetch_metadata(url: str = API_URL) -> dict:
    validate_api_url(url)
    request = Request(url, headers={"Accept": "application/json", "User-Agent": "FloodExplorer-MetadataCheck/1.0"})
    with build_opener(ZenodoRedirectHandler()).open(request, timeout=30) as response:
        return json.load(response)


def inspect_metadata(metadata: dict) -> dict:
    if not isinstance(metadata, dict):
        raise ValueError("Zenodo metadata must be an object")
    errors = []
    record_id = str(metadata.get("id", ""))
    if record_id != PINNED_RECORD_ID:
        errors.append("record_id_mismatch" if record_id else "missing_record_id")
    details = metadata.get("metadata") or {}
    if not isinstance(details, dict):
        details = {}
    links = metadata.get("links") or {}
    if not isinstance(links, dict):
        links = {}
    files = metadata.get("files") or []
    if not isinstance(files, list):
        files = []
    file = next((entry for entry in files if isinstance(entry, dict) and entry.get("key") == PINNED_FILE), None)
    if file is None:
        errors.append("missing_pinned_file")
        file = {}
    for field in ("checksum", "size"):
        if file.get(field) is None:
            errors.append(f"missing_file_{field}")
    if not metadata.get("modified"):
        errors.append("missing_modified")
    latest = links.get("latest") or links.get("latest_html")
    # Report API relations verbatim; never infer global latest status from a title.
    return {"source": API_URL, "pinned_record_id": PINNED_RECORD_ID, "record_id": record_id or None, "version": details.get("version"), "published": details.get("publication_date"), "modified": metadata.get("modified"), "file": {"key": PINNED_FILE, "checksum": file.get("checksum"), "size_bytes": file.get("size")}, "latest_relation": latest, "latest_relation_matches_pin": None, "errors": errors, "status": "ok" if not errors else "invalid_metadata"}


def resolve_latest(result: dict) -> dict:
    relation = result.get("latest_relation")
    validate_api_url(relation)
    latest = inspect_metadata(fetch_metadata(relation))
    # A different record is expected when an upstream version exists.
    latest["errors"] = [error for error in latest["errors"] if error != "record_id_mismatch"]
    if latest["errors"]:
        raise ValueError("Invalid latest metadata: " + ", ".join(latest["errors"]))
    return {"record_id": latest["record_id"], "published": latest["published"], "modified": latest["modified"], "file": latest["file"], "matches_pin": latest["record_id"] == PINNED_RECORD_ID}


def run_check(metadata_file: Path | None = None, check_latest: bool = False) -> dict:
    checked_at = datetime.now(timezone.utc).isoformat()
    try:
        metadata = json.loads(metadata_file.read_text(encoding="utf-8")) if metadata_file else fetch_metadata()
        result = inspect_metadata(metadata)
        if check_latest and result["status"] == "ok":
            result["resolved_latest"] = resolve_latest(result)
            result["latest_relation_matches_pin"] = result["resolved_latest"]["matches_pin"]
    except (OSError, URLError, ValueError, TypeError) as exc:
        result = {"source": API_URL, "pinned_record_id": PINNED_RECORD_ID, "status": "check_failed", "errors": [str(exc)]}
    return {"checked_at": checked_at, "input": str(metadata_file) if metadata_file else "official_zenodo_api", **result}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--metadata-file", type=Path, help="Inspect saved API JSON instead of contacting Zenodo")
    parser.add_argument("--output", type=Path, help="Write the metadata-check result as JSON")
    parser.add_argument("--check-latest", action="store_true", help="Resolve the official latest-version API relation (metadata only)")
    args = parser.parse_args()
    result = run_check(args.metadata_file, args.check_latest)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))
    return int(result["status"] != "ok")


if __name__ == "__main__":
    raise SystemExit(main())
