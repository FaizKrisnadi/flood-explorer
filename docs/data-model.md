# Data Model

## Goal

Build one stable Indonesian geospatial reference layer keyed by Kemendagri codes, then join Groundsource by spatial intersection.

## Recommended canonical tables

### `dim_admin_unit`

One row per Indonesian administrative unit.

Columns:

- `code`
- `name`
- `level` (`province`, `regency`, `district`, `village`)
- `province_code`
- `regency_code`
- `district_code`
- `village_code`

### `bridge_village_postal_code`

Village-to-postal mapping.

Columns:

- `village_code`
- `postal_code`

### `dim_village_boundary`

Village polygons as the core geometry layer for the dashboard.

Columns:

- `village_code`
- `name`
- `province_code`
- `regency_code`
- `district_code`
- `postal_code`
- `centroid_lat`
- `centroid_lng`
- `geometry`
- `boundary_status`

### `fact_groundsource_flood_footprint`

Raw or lightly cleaned Groundsource polygons.

Columns:

- `uuid`
- `start_date`
- `end_date`
- `area_km2`
- `geometry`

### `bridge_groundsource_village_intersection`

Spatial join result between Groundsource and village polygons.

Columns:

- `uuid`
- `village_code`
- `intersection_area_km2`
- `footprint_area_km2`
- `village_area_km2`
- `coverage_ratio_of_village`
- `coverage_ratio_of_footprint`

### `fact_village_flood_day`

Dashboard-ready aggregate.

Columns:

- `event_date`
- `village_code`
- `postal_code`
- `event_count`
- `unique_event_count`
- `sum_intersection_area_km2`
- `max_coverage_ratio_of_village`

## Join strategy

1. Normalize admin codes and postal codes from `wilayah.sql` and `wilayah_kodepos.sql`.
2. Parse village boundaries from `wilayah_boundaries`.
3. Convert boundary coordinate order from `[lat, lng]` to `[lng, lat]`.
4. Intersect Groundsource polygons with village polygons.
5. Aggregate to village, district, regency, province, and postal code as needed.

## Practical recommendations

- Make `village_code` the lowest-level geographic key.
- Keep Groundsource raw geometries separate from derived intersection tables.
- Do not join by names.
- Materialize aggregates by date and admin level for fast dashboard filters.
- Keep a boundary coverage report because `wilayah_boundaries` is not yet fully complete at village level.
