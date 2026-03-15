# Groundsource Inspection

Source: [Zenodo record 18647054](https://zenodo.org/records/18647054)

## File metadata

- File: `groundsource_2026.parquet`
- Size: `667,122,400` bytes
- Format: Parquet / GeoParquet-like metadata
- Record title: `Groundsource: A Dataset of Flood Events from News`

## Schema

The parquet metadata exposes only six columns:

| column | type | nullable |
| --- | --- | --- |
| `uuid` | `string` | yes |
| `area_km2` | `double` | yes |
| `geometry` | `binary` | yes |
| `start_date` | `string` | yes |
| `end_date` | `string` | yes |
| `__index_level_0__` | `int64` | yes |

## What this means for the dashboard

- The dataset is geometry-first.
- There is no Indonesia admin code, province name, regency name, district name, village name, or postal code in the parquet metadata.
- Joining to Indonesia must therefore be done spatially by intersecting Groundsource geometries with Indonesian administrative polygons.
- `start_date` and `end_date` are string dates, so the first transform should cast them to actual dates.
- `geometry` is WKB in EPSG:4326 according to the GeoParquet metadata.

## Row-group summary

- Total rows: `2,646,302`
- Row groups: `3`
- Date coverage from row-group stats:
  - `start_date`: `2000-01-01` to `2026-02-03`
  - `end_date`: `2000-01-01` to `2026-02-03`
- `area_km2` ranges roughly from `0.0000017` to `4998.8`

## Technical note

DuckDB currently rejects the file with:

`Invalid Input Error: Geoparquet column 'geometry' does not have geometry types`

PyArrow can still read the metadata, so the parquet is usable, but you should expect some engines to be stricter than others.
