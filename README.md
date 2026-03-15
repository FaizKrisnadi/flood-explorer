<p align="center">
  <img src="docs/readme-preview.png" alt="Indonesia Flood Explorer dashboard preview" width="100%" />
</p>

<h1 align="center">Indonesia Flood Explorer</h1>

<p align="center">
  <strong>Public-facing flood intelligence dashboard for exploring Groundsource flood events across Indonesia's administrative geography.</strong>
</p>

<p align="center">
  Static site delivery · bilingual UI · province to district drill-down · manifest-driven public assets
</p>

<p align="center">
  <a href="https://flood.faizkrisnadi.com">
    <img src="https://img.shields.io/badge/LIVE%20DASHBOARD-flood.faizkrisnadi.com-b45309?style=for-the-badge&labelColor=5f4a3a" alt="Live dashboard" />
  </a>
  <img src="https://img.shields.io/badge/STACK-Static%20HTML%20%7C%20CSS%20%7C%20JS-f5a623?style=for-the-badge&labelColor=2c2418" alt="Stack" />
  <img src="https://img.shields.io/badge/UI-Bilingual%20(ID%20%2F%20EN)-4f7ec4?style=for-the-badge&labelColor=2c2418" alt="Bilingual UI" />
  <img src="https://img.shields.io/badge/GEOGRAPHY-Province%20%E2%86%92%20Regency%2FCity%20%E2%86%92%20District-0f766e?style=for-the-badge&labelColor=2c2418" alt="Geography coverage" />
</p>

<p align="center">
  <a href="#overview"><code>Overview</code></a>
  <span>·</span>
  <a href="#why-this-repo-exists"><code>Why This Repo Exists</code></a>
  <span>·</span>
  <a href="#repository-layout"><code>Repository Layout</code></a>
  <span>·</span>
  <a href="#local-setup"><code>Local Setup</code></a>
  <span>·</span>
  <a href="#rebuild-workflow"><code>Rebuild Workflow</code></a>
  <span>·</span>
  <a href="#public-release-contract"><code>Public Release Contract</code></a>
</p>

---

## Overview

> Open the deployed dashboard at [flood.faizkrisnadi.com](https://flood.faizkrisnadi.com).

<table>
  <tr>
    <td width="33%" valign="top">
      <strong>Map-first public product</strong><br />
      The shipped app is a plain static dashboard under <code>site/</code> designed for direct public delivery, not a private analyst workspace.
    </td>
    <td width="33%" valign="top">
      <strong>Indonesia-first admin hierarchy</strong><br />
      Flood footprints are aligned to a canonical Indonesian geography keyed by province, regency/city, and district administrative codes.
    </td>
    <td width="33%" valign="top">
      <strong>Manifest-driven runtime</strong><br />
      The frontend reads prebuilt assets from <code>site/data/latest/</code> so deployment stays simple, deterministic, and cache-friendly.
    </td>
  </tr>
</table>

## Why This Repo Exists

This repository packages a public-facing view of Groundsource flood activity into a dashboard that can be inspected, shared, and deployed without exposing the local build chain or raw source materials. The goal is to make flood patterns legible by place and time while keeping data coverage caveats visible in the product itself.

## What the Dashboard Does

- Maps flood intensity across Indonesia using prebuilt JSON and GeoJSON assets.
- Supports Indonesian and English labels from the same static frontend.
- Exposes search, overview metrics, time filtering, and admin-level drill-down.
- Keeps methodology and coverage visible instead of burying caveats outside the product.
- Ships as static files, so hosting stays straightforward on GitHub and Cloudflare Pages.

## Repository Layout

| Path | Purpose |
| --- | --- |
| `site/` | Static frontend, translations, and committed runtime payload |
| `site/data/latest/` | Public release assets consumed directly by the browser |
| `scripts/` | ETL, packaging, data inspection, and build helpers |
| `tests/` | Lightweight Python test coverage |
| `docs/` | Schema notes, reference material, and README assets |

Local build inputs and intermediate outputs under `data/raw/` and `data/processed/` are intentionally not tracked.

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

## Public Release Contract

- Groundsource is the flood-event source of truth.
- Indonesian admin codes are the canonical join keys.
- The public release currently includes province, regency/city, and district layers.
- The frontend reads only manifest-driven assets from `site/data/latest/`.
- The dashboard is for public information only, not early warning or operational use.

## Notes

- `wilayah_boundaries` coordinates are stored as `[lat, lng]`, so the ETL swaps them to `[lng, lat]` before writing geometry outputs.
- With the current downloaded sample, the district release gate is expected to fail because nationwide coverage is still incomplete.

## Rights and Reuse

This repository is public for transparency and deployment, but no open-source license is granted here. Unless stated otherwise, all rights are reserved by Faiz Krisnadi.
