<p align="center">
  <img src="docs/readme-preview.png" alt="Indonesia Flood Explorer dashboard preview" width="100%" />
</p>

<h1 align="center">Indonesia Flood Explorer</h1>

<p align="center">
  <strong>Reproducible Indonesia flood-data pipeline and static explorer built around Groundsource flood events and auditable administrative geography.</strong>
</p>

<p align="center">
  Open civic-tech data infrastructure · static public explorer · bilingual UI · manifest-driven release assets
</p>

<p align="center">
  <a href="https://github.com/FaizKrisnadi/flood-explorer/actions/workflows/tests.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/FaizKrisnadi/flood-explorer/tests.yml?branch=main&label=tests&style=for-the-badge" alt="Tests status" />
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-1f6feb?style=for-the-badge" alt="MIT license" />
  </a>
  <a href="https://flood.faizkrisnadi.com">
    <img src="https://img.shields.io/badge/live-flood.faizkrisnadi.com-b45309?style=for-the-badge&labelColor=5f4a3a" alt="Live dashboard" />
  </a>
</p>

<p align="center">
  <a href="#overview"><code>Overview</code></a>
  <span>·</span>
  <a href="#who-this-is-for"><code>Who This Is For</code></a>
  <span>·</span>
  <a href="#why-this-matters"><code>Why This Matters</code></a>
  <span>·</span>
  <a href="#repository-layout"><code>Repository Layout</code></a>
  <span>·</span>
  <a href="#local-setup"><code>Local Setup</code></a>
  <span>·</span>
  <a href="#how-to-reuse-this-repo"><code>How to Reuse This Repo</code></a>
  <span>·</span>
  <a href="#public-data-contract"><code>Public Data Contract</code></a>
</p>

---

## Overview

> Open the deployed explorer at [flood.faizkrisnadi.com](https://flood.faizkrisnadi.com).

This repository packages the ETL, release gating, and static delivery workflow for publishing Groundsource flood activity against Indonesia's administrative geography. The shipped frontend under `site/` is the public proof layer; the maintainer value is the reproducible path from reference data and flood footprints to browser-ready release assets under `site/data/latest/`.

<table>
  <tr>
    <td width="33%" valign="top">
      <strong>Auditable geography joins</strong><br />
      Flood footprints are aligned to canonical Indonesian province, regency/city, and district codes instead of loose name matching.
    </td>
    <td width="33%" valign="top">
      <strong>Manifest-driven public release</strong><br />
      The browser reads committed JSON and GeoJSON payloads from <code>site/data/latest/</code> for deterministic static hosting.
    </td>
    <td width="33%" valign="top">
      <strong>Low-friction civic-tech deployment</strong><br />
      The release artifact is a plain static site that can be served from GitHub Pages, Cloudflare Pages, or any static host.
    </td>
  </tr>
</table>

## Who This Is For

- Civic-tech teams publishing map-first public information products.
- Researchers and journalists who need auditable flood geography joins and transparent caveats.
- NGOs and local-government analysts who want static delivery instead of a complex app stack.
- Contributors interested in data QA, release gating, documentation, or frontend accessibility.

## Why This Matters

- Indonesian flood data is fragmented across source systems, geometry quality varies, and public products often hide release caveats. This repo keeps those caveats in the artifact itself.
- Administrative joins must stay auditable. The pipeline uses stable Kemendagri-style codes and coverage reporting instead of fragile name-based matching.
- Public-interest products need cheap, reliable deployment. Shipping prebuilt assets from `site/data/latest/` keeps hosting simple and reviewable.

## How Location Assignment Works

- Groundsource does not provide Indonesia province, regency, district, village, or postal-code fields.
- Every Indonesia location result in this repo is produced by geometry overlap, not by text matching or name inference.
- The ETL decodes Groundsource flood polygons from WKB, intersects them with Indonesian administrative polygons, and aggregates the overlap results by province, regency/city, and district.
- A single flood event can intersect multiple districts, regencies, or provinces. The dashboard should therefore be read as an overlap-based aggregate view, not as a single authoritative district label for each event.
- Public metrics such as `unique_event_count`, `sum_intersection_area_km2`, and `max_coverage_ratio` describe intersecting events within each geography and period.

## Repository Layout

| Path | Purpose |
| --- | --- |
| `site/` | Static frontend, translations, and committed runtime payload |
| `site/data/latest/` | Browser-consumed public release assets committed with the repo |
| `scripts/` | ETL, packaging, validation, and build helpers |
| `tests/` | Python test coverage for pipeline and repo validation helpers |
| `docs/` | Data model notes, maintainer docs, and project positioning |

Local source downloads and intermediate build outputs under `data/raw/` and `data/processed/` are intentionally not tracked.

## Local Setup

Geometry-heavy scripts should be run on Python 3.13.

```bash
python3.13 -m venv .venv
./.venv/bin/pip install -r requirements.txt
```

### Quick Preview

```bash
python3 -m http.server 4173 --directory site
```

Then open `http://127.0.0.1:4173/`.

## Rebuild Workflow

1. Inspect the remote Groundsource parquet without downloading it.

```bash
./.venv/bin/python scripts/inspect_groundsource.py
```

2. Fetch Indonesia reference sources into `data/raw/`.

```bash
./.venv/bin/python scripts/fetch_sources.py --province 31
```

3. Build canonical reference outputs into `data/processed/`.

```bash
./.venv/bin/python scripts/build_reference_geoparquet.py
```

4. Build Groundsource facts after `data/raw/groundsource/groundsource_2026.parquet` exists locally.

```bash
./.venv/bin/python scripts/build_groundsource_facts.py
```

If the Groundsource parquet is missing, the script writes a manifest with `missing_groundsource_source` instead of failing the entire build.

5. Package the public site payload into `site/data/latest/`.

```bash
./.venv/bin/python scripts/build_public_site_data.py
```

That packaging step refreshes:

- `site/data/latest/build_manifest.json`
- `site/data/latest/boundaries/*.geojson`
- `site/data/latest/search_index.json`
- `site/data/latest/coverage_report.json`
- `site/data/latest/methodology.json`
- `site/data/latest/metrics/...`
- `site/data/latest/qualitative_events.json`
- `site/data/latest/geography_review_states.json`
- `site/data/latest/regencies/index.json`

## How to Reuse This Repo

1. Inspect and build the dataset locally.
   Run the ETL scripts in `scripts/` to inspect Groundsource availability, fetch references, build canonical geography, and package public assets.
2. Publish the static explorer.
   Serve `site/` as static files after updating `site/data/latest/`. The frontend is already wired to manifest-driven public assets.
3. Adapt the pipeline for another release.
   Reuse the reference-build and packaging workflow to swap source windows, tighten release gates, or target another Indonesian subnational release cadence.

## Public Data Contract

The public artifact consumed by the browser is the committed `site/data/latest/` tree. The stable release contract is:

- `build_manifest.json`: runtime entrypoint for default language, levels, metrics, and asset paths.
- `boundaries/province.geojson`, `boundaries/regency.geojson`, `boundaries/district.geojson`: simplified browser-facing geometry layers.
- `metrics/<level>/summary_all_time.json`: rolled-up metrics per published level.
- `metrics/<level>/month/*.json`: month buckets listed in the build manifest.
- `metrics/<level>/trend/*.json`: geography-specific trend shards consumed on drill-down.
- `coverage_report.json`: release-gate and coverage metadata for the published geography.
- `search_index.json`: lookup index for province, regency/city, and district search.
- `methodology.json`: source, metric, and caveat metadata rendered by the frontend.
- `qualitative_events.json`: global qualitative evidence fallback payload.
- `geography_review_states.json`: global review-state fallback payload.
- `regencies/index.json`: registry for regency-specific qualitative bundles loaded on demand.

Groundsource remains the flood-event source of truth. Indonesian admin codes remain the canonical join keys. The public release currently publishes province, regency/city, and district layers only. The dashboard is for public information, not early warning or operational emergency response.

## Project Health

- Contributor guide: [CONTRIBUTING.md](CONTRIBUTING.md)
- Security policy: [SECURITY.md](SECURITY.md)
- Code of conduct: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- Changelog: [CHANGELOG.md](CHANGELOG.md)
- Citation metadata: [CITATION.cff](CITATION.cff)
- Maintainer release notes: [docs/maintainer-release.md](docs/maintainer-release.md)
- Qualitative runtime contract: [docs/qualitative-contract.md](docs/qualitative-contract.md)
- Regency release runbook: [docs/regency-release-runbook.md](docs/regency-release-runbook.md)
- Project positioning for Codex for Open Source: [docs/project-positioning.md](docs/project-positioning.md)

## Notes

- `wilayah_boundaries` coordinates are stored as `[lat, lng]`, so the ETL swaps them to `[lng, lat]` before writing geometry outputs.
- With incomplete nationwide district coverage, the district release gate may fail until the reference geography crosses the configured threshold.

## Rights and Reuse

This repository is released under the MIT License. See [LICENSE](LICENSE) for the full text.
