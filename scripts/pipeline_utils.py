from __future__ import annotations

import json
from collections.abc import Iterable
from pathlib import Path
from typing import Any

import pyarrow as pa
import pyarrow.parquet as pq


WGS84_CRS = {
    "$schema": "https://proj.org/schemas/v0.7/projjson.schema.json",
    "type": "GeographicCRS",
    "name": "WGS 84",
    "datum_ensemble": {
        "name": "World Geodetic System 1984 ensemble",
        "members": [
            {"name": "World Geodetic System 1984 (Transit)", "id": {"authority": "EPSG", "code": 1166}},
            {"name": "World Geodetic System 1984 (G730)", "id": {"authority": "EPSG", "code": 1152}},
            {"name": "World Geodetic System 1984 (G873)", "id": {"authority": "EPSG", "code": 1153}},
            {"name": "World Geodetic System 1984 (G1150)", "id": {"authority": "EPSG", "code": 1154}},
            {"name": "World Geodetic System 1984 (G1674)", "id": {"authority": "EPSG", "code": 1155}},
            {"name": "World Geodetic System 1984 (G1762)", "id": {"authority": "EPSG", "code": 1156}},
            {"name": "World Geodetic System 1984 (G2139)", "id": {"authority": "EPSG", "code": 1309}},
            {"name": "World Geodetic System 1984 (G2296)", "id": {"authority": "EPSG", "code": 1383}},
        ],
        "ellipsoid": {"name": "WGS 84", "semi_major_axis": 6378137, "inverse_flattening": 298.257223563},
        "accuracy": "2.0",
        "id": {"authority": "EPSG", "code": 6326},
    },
    "coordinate_system": {
        "subtype": "ellipsoidal",
        "axis": [
            {"name": "Geodetic latitude", "abbreviation": "Lat", "direction": "north", "unit": "degree"},
            {"name": "Geodetic longitude", "abbreviation": "Lon", "direction": "east", "unit": "degree"},
        ],
    },
    "scope": "Horizontal component of 3D system.",
    "area": "World.",
    "bbox": {"south_latitude": -90, "west_longitude": -180, "north_latitude": 90, "east_longitude": 180},
    "id": {"authority": "EPSG", "code": 4326},
}


def sql_unquote(token: str) -> Any:
    token = token.strip()
    if token.upper() == "NULL":
        return None
    if token.startswith("'") and token.endswith("'"):
        return token[1:-1].replace("''", "'")
    try:
        if "." in token:
            return float(token)
        return int(token)
    except ValueError:
        return token


def extract_insert_tuples(sql_text: str) -> list[list[Any]]:
    rows: list[list[Any]] = []
    marker = "VALUES"
    start = 0
    while True:
        values_index = sql_text.find(marker, start)
        if values_index == -1:
            break
        semicolon_index = sql_text.find(";", values_index)
        block = sql_text[values_index + len(marker) : semicolon_index]
        tuple_buffer: list[Any] = []
        field_buffer: list[str] = []
        depth = 0
        in_string = False
        i = 0
        while i < len(block):
            char = block[i]
            nxt = block[i + 1] if i + 1 < len(block) else ""
            if depth == 0 and char not in {"(", "'"}:
                i += 1
                continue
            if char == "'" and in_string and nxt == "'":
                field_buffer.append("''")
                i += 2
                continue
            if char == "'":
                in_string = not in_string
                field_buffer.append(char)
                i += 1
                continue
            if not in_string and char == "(":
                depth += 1
                i += 1
                continue
            if not in_string and char == ")":
                if field_buffer:
                    tuple_buffer.append(sql_unquote("".join(field_buffer)))
                    field_buffer = []
                rows.append(tuple_buffer)
                tuple_buffer = []
                depth -= 1
                i += 1
                continue
            if not in_string and char == "," and depth == 1:
                tuple_buffer.append(sql_unquote("".join(field_buffer)))
                field_buffer = []
                i += 1
                continue
            field_buffer.append(char)
            i += 1
        start = semicolon_index + 1
    return rows


def classify_code(code: str) -> tuple[str, str | None, str | None, str | None]:
    parts = code.split(".")
    province_code = parts[0]
    regency_code = ".".join(parts[:2]) if len(parts) >= 2 else None
    district_code = ".".join(parts[:3]) if len(parts) >= 3 else None
    if len(parts) == 1:
        level = "province"
    elif len(parts) == 2:
        level = "regency"
    elif len(parts) == 3:
        level = "district"
    elif len(parts) == 4:
        level = "village"
    else:
        raise ValueError(f"unexpected code format: {code}")
    return level, province_code, regency_code, district_code


def swap_lat_lng(coords: Any) -> Any:
    if not isinstance(coords, list):
        return coords
    if len(coords) == 2 and all(isinstance(item, (int, float)) for item in coords):
        lat, lng = coords
        return [lng, lat]
    return [swap_lat_lng(item) for item in coords]


def geometry_from_path(path_lng_lat: str):
    from shapely.geometry import shape

    return shape({"type": "MultiPolygon", "coordinates": _normalize_polygon_coords(json.loads(path_lng_lat))})


def _normalize_polygon_coords(coords: Any) -> Any:
    depth = coords
    nested = 0
    while isinstance(depth, list):
        nested += 1
        depth = depth[0] if depth else []
    if nested == 3:
        return [coords]
    if nested == 4:
        return coords
    raise ValueError(f"unexpected coordinate nesting depth: {nested}")


def load_admin_rows(raw_dir: Path) -> list[dict[str, Any]]:
    sql_text = (raw_dir / "wilayah.sql").read_text(encoding="utf-8")
    rows: list[dict[str, Any]] = []
    for code, name in extract_insert_tuples(sql_text):
        level, province_code, regency_code, district_code = classify_code(code)
        rows.append(
            {
                "code": code,
                "name": name,
                "level": level,
                "province_code": province_code,
                "regency_code": regency_code,
                "district_code": district_code,
                "village_code": code if level == "village" else None,
            }
        )
    return rows


def load_postal_rows(raw_dir: Path) -> list[dict[str, Any]]:
    sql_text = (raw_dir / "wilayah_kodepos.sql").read_text(encoding="utf-8")
    return [{"village_code": code, "postal_code": postal_code} for code, postal_code in extract_insert_tuples(sql_text)]


def load_boundary_rows(raw_dir: Path, boundary_dir_name: str, level: str) -> list[dict[str, Any]]:
    base = raw_dir / "boundaries" / boundary_dir_name
    if not base.exists():
        return []
    rows: list[dict[str, Any]] = []
    for sql_file in sorted(base.rglob("*.sql")):
        sql_text = sql_file.read_text(encoding="utf-8")
        for values in extract_insert_tuples(sql_text):
            if len(values) < 5:
                continue
            code, name, lat, lng, path = values[:5]
            rows.append(
                {
                    "code": str(code),
                    "name": name,
                    "level": level,
                    "centroid_lat": float(lat) if lat is not None else None,
                    "centroid_lng": float(lng) if lng is not None else None,
                    "path_lat_lng": path,
                    "path_lng_lat": json.dumps(swap_lat_lng(json.loads(path))),
                    "geometry": geometry_from_path(json.dumps(swap_lat_lng(json.loads(path)))),
                    "boundary_source": "raw",
                }
            )
    return rows


def parent_code_for_level(row: dict[str, Any], target_level: str) -> str | None:
    if target_level == "province":
        return row.get("province_code")
    if target_level == "regency":
        return row.get("regency_code")
    if target_level == "district":
        return row.get("district_code")
    if target_level == "village":
        return row.get("village_code") or row.get("code")
    raise ValueError(f"unsupported level: {target_level}")


def encode_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2)


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(encode_json(value), encoding="utf-8")


def write_tabular_parquet(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    table = pa.Table.from_pylist(rows)
    pq.write_table(table, path)


def write_geoparquet(path: Path, rows: list[dict[str, Any]]) -> None:
    from shapely.wkb import dumps as dump_wkb

    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        schema = pa.schema([pa.field("geometry", pa.binary())], metadata={b"geo": encode_json({"primary_column": "geometry", "columns": {}}).encode("utf-8")})
        pq.write_table(pa.Table.from_pylist([], schema=schema), path)
        return

    sample = rows[0]
    property_names = [key for key in sample if key != "geometry"]
    records = []
    geometries = []
    geometry_types = set()
    bounds = []
    for row in rows:
        geometry = row["geometry"]
        records.append({key: row.get(key) for key in property_names})
        geometries.append(dump_wkb(geometry))
        geometry_types.add(geometry.geom_type)
        minx, miny, maxx, maxy = geometry.bounds
        bounds.append((minx, miny, maxx, maxy))

    property_table = pa.Table.from_pylist(records)
    geometry_field = pa.field(
        "geometry",
        pa.binary(),
        metadata={
            b"ARROW:extension:name": b"geoarrow.wkb",
            b"ARROW:extension:metadata": encode_json({"crs": WGS84_CRS}).encode("utf-8"),
        },
    )
    geometry_array = pa.array(geometries, type=pa.binary())
    fields = list(property_table.schema)
    fields.append(geometry_field)
    all_bounds = [
        min(item[0] for item in bounds),
        min(item[1] for item in bounds),
        max(item[2] for item in bounds),
        max(item[3] for item in bounds),
    ]
    geo_metadata = {
        "primary_column": "geometry",
        "columns": {
            "geometry": {
                "encoding": "WKB",
                "crs": WGS84_CRS,
                "geometry_types": sorted(geometry_types),
                "bbox": all_bounds,
            }
        },
        "version": "1.0.0",
        "creator": {"library": "pyarrow+shapely", "version": f"{pa.__version__}"},
    }
    schema = pa.schema(fields, metadata={b"geo": encode_json(geo_metadata).encode("utf-8")})
    columns = [property_table[column] for column in property_table.column_names] + [geometry_array]
    pq.write_table(pa.Table.from_arrays(columns, schema=schema), path)


def read_geoparquet_rows(path: Path) -> list[dict[str, Any]]:
    from shapely.wkb import loads as load_wkb

    table = pq.read_table(path)
    rows = table.to_pylist()
    for row in rows:
        geometry = row.get("geometry")
        if geometry is not None:
            row["geometry"] = load_wkb(geometry)
    return rows


def write_geojson(path: Path, rows: list[dict[str, Any]]) -> None:
    from shapely.geometry import mapping

    path.parent.mkdir(parents=True, exist_ok=True)
    features = []
    for row in rows:
        props = {key: value for key, value in row.items() if key != "geometry"}
        features.append({"type": "Feature", "properties": props, "geometry": mapping(row["geometry"])})
    payload = {"type": "FeatureCollection", "features": features}
    path.write_text(encode_json(payload), encoding="utf-8")


def dissolve_geometries(rows: Iterable[dict[str, Any]], by: str) -> dict[str, Any]:
    from shapely.ops import unary_union

    groups: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        code = row.get(by)
        if code:
            groups.setdefault(code, []).append(row)

    dissolved: dict[str, Any] = {}
    for code, members in groups.items():
        dissolved[code] = unary_union([member["geometry"] for member in members])
    return dissolved
