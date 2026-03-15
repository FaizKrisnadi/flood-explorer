from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from urllib.request import urlopen


PROJECT_ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = PROJECT_ROOT / "data" / "raw"

GROUND_SOURCE_URL = (
    "https://zenodo.org/api/records/18647054/files/groundsource_2026.parquet/content"
)

CORE_FILES = {
    "reference/wilayah.sql": "https://raw.githubusercontent.com/cahyadsn/wilayah/master/db/wilayah.sql",
    "reference/wilayah_kodepos.sql": "https://raw.githubusercontent.com/cahyadsn/wilayah_kodepos/main/db/wilayah_kodepos.sql",
    "reference/wilayah_luas.sql": "https://raw.githubusercontent.com/cahyadsn/wilayah/master/db/wilayah_luas.sql",
    "reference/wilayah_penduduk.sql": "https://raw.githubusercontent.com/cahyadsn/wilayah/master/db/wilayah_penduduk.sql",
    "reference/wilayah_boundaries_ddl.sql": "https://raw.githubusercontent.com/cahyadsn/wilayah_boundaries/main/db/ddl_wilayah_boundaries.sql",
}


def github_json(url: str) -> list[dict]:
    with urlopen(url) as response:
        return json.load(response)


def download(url: str, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    with urlopen(url) as response, target.open("wb") as fh:
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            fh.write(chunk)
    print(f"saved {target}")


def list_boundary_files(level: str, province_codes: list[str] | None) -> list[tuple[str, str]]:
    files: list[tuple[str, str]] = []
    if level in {"prov", "kab", "kec"}:
        api_url = f"https://api.github.com/repos/cahyadsn/wilayah_boundaries/contents/db/{level}?ref=main"
        for item in github_json(api_url):
            files.append((f"reference/boundaries/{level}/{item['name']}", item["download_url"]))
        return files

    if level != "kel":
        raise ValueError(f"unsupported boundary level: {level}")

    codes = province_codes or []
    for province_code in codes:
        api_url = (
            "https://api.github.com/repos/cahyadsn/wilayah_boundaries/contents/"
            f"db/kel/{province_code}?ref=main"
        )
        for item in github_json(api_url):
            files.append(
                (
                    f"reference/boundaries/kel/{province_code}/{item['name']}",
                    item["download_url"],
                )
            )
    return files


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Download Indonesia reference data and optional Groundsource parquet into the local workspace."
    )
    parser.add_argument(
        "--project-root",
        type=Path,
        default=PROJECT_ROOT,
        help="Project root. Defaults to this script's parent folder.",
    )
    parser.add_argument(
        "--province",
        action="append",
        default=[],
        help="Province code for village boundary downloads. Repeatable, e.g. --province 32 --province 33",
    )
    parser.add_argument(
        "--download-groundsource",
        action="store_true",
        help="Download the 667 MB Groundsource parquet into data/raw/groundsource.",
    )
    parser.add_argument(
        "--skip-core",
        action="store_true",
        help="Skip small core SQL files.",
    )
    parser.add_argument(
        "--skip-wide-boundaries",
        action="store_true",
        help="Skip province, regency, and district boundary files.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    raw_dir = args.project_root / "data" / "raw"

    if not args.skip_core:
        for relative_path, url in CORE_FILES.items():
            download(url, raw_dir / relative_path)

    if not args.skip_wide_boundaries:
        for level in ("prov", "kab", "kec"):
            for relative_path, url in list_boundary_files(level, None):
                download(url, raw_dir / relative_path)

    if args.province:
        for relative_path, url in list_boundary_files("kel", args.province):
            download(url, raw_dir / relative_path)
    else:
        print("skipping village boundary downloads: pass --province to fetch targeted province folders")

    if args.download_groundsource:
        target = raw_dir / "groundsource" / "groundsource_2026.parquet"
        download(GROUND_SOURCE_URL, target)
    else:
        print("skipping Groundsource parquet download")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
