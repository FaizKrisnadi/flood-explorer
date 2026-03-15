from __future__ import annotations

import argparse
import io
import json
from pathlib import Path
from urllib.request import Request, urlopen


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_URL = (
    "https://zenodo.org/api/records/18647054/files/groundsource_2026.parquet/content"
)


class HTTPRangeReader(io.RawIOBase):
    def __init__(self, url: str):
        self.url = url
        request = Request(url, method="HEAD")
        with urlopen(request) as response:
            self.length = int(response.headers["Content-Length"])
        self.position = 0

    def readable(self) -> bool:
        return True

    def seekable(self) -> bool:
        return True

    def tell(self) -> int:
        return self.position

    def seek(self, offset: int, whence: int = io.SEEK_SET) -> int:
        if whence == io.SEEK_SET:
            self.position = offset
        elif whence == io.SEEK_CUR:
            self.position += offset
        elif whence == io.SEEK_END:
            self.position = self.length + offset
        return self.position

    def read(self, size: int = -1) -> bytes:
        if self.position >= self.length:
            return b""
        if size is None or size < 0:
            end = self.length - 1
        else:
            end = min(self.position + size, self.length) - 1
        request = Request(self.url, headers={"Range": f"bytes={self.position}-{end}"})
        with urlopen(request) as response:
            data = response.read()
        self.position += len(data)
        return data


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Inspect remote Groundsource parquet metadata.")
    parser.add_argument("--url", default=DEFAULT_URL)
    parser.add_argument(
        "--json-output",
        type=Path,
        default=PROJECT_ROOT / "docs" / "groundsource_schema.json",
    )
    return parser.parse_args()


def main() -> int:
    try:
        import pyarrow.parquet as pq
    except ModuleNotFoundError as exc:
        raise SystemExit(
            "pyarrow is required. Install it with `python3 -m pip install pyarrow`."
        ) from exc

    args = parse_args()
    parquet = pq.ParquetFile(HTTPRangeReader(args.url))

    fields = []
    for field in parquet.schema_arrow:
        fields.append(
            {
                "name": field.name,
                "type": str(field.type),
                "nullable": field.nullable,
            }
        )

    row_groups = []
    for row_group_index in range(parquet.num_row_groups):
        row_group = parquet.metadata.row_group(row_group_index)
        start_stats = row_group.column(3).statistics
        end_stats = row_group.column(4).statistics
        area_stats = row_group.column(1).statistics
        row_groups.append(
            {
                "row_group": row_group_index,
                "rows": row_group.num_rows,
                "start_date_min": start_stats.min,
                "start_date_max": start_stats.max,
                "end_date_min": end_stats.min,
                "end_date_max": end_stats.max,
                "area_km2_min": area_stats.min,
                "area_km2_max": area_stats.max,
            }
        )

    metadata = parquet.metadata.metadata or {}
    report = {
        "url": args.url,
        "num_rows": parquet.metadata.num_rows,
        "num_row_groups": parquet.num_row_groups,
        "created_by": parquet.metadata.created_by,
        "format_version": parquet.metadata.format_version,
        "fields": fields,
        "geo_metadata": metadata.get(b"geo", b"").decode("utf-8", errors="ignore"),
        "row_groups": row_groups,
    }

    args.json_output.parent.mkdir(parents=True, exist_ok=True)
    args.json_output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    print(f"saved {args.json_output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
