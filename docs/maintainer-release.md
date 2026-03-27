# Maintainer Release Notes

This repository publishes a committed static release artifact under `site/data/latest/`. The browser only consumes files from that tree, so release work is mostly about regenerating and validating those assets without breaking the manifest contract.

## Release path

1. Inspect Groundsource availability.

   ```bash
   ./.venv/bin/python scripts/inspect_groundsource.py
   ```

2. Fetch or refresh reference inputs into `data/raw/`.

   ```bash
   ./.venv/bin/python scripts/fetch_sources.py --province 31
   ```

3. Rebuild canonical reference geography into `data/processed/`.

   ```bash
   ./.venv/bin/python scripts/build_reference_geoparquet.py
   ```

4. Build Groundsource facts after the local parquet is present.

   ```bash
   ./.venv/bin/python scripts/build_groundsource_facts.py
   ```

5. Package browser-consumed assets into `site/data/latest/`.

   ```bash
   ./.venv/bin/python scripts/build_public_site_data.py
   ```

6. Rebuild the qualitative regency index when any regency bundle changed.

   ```bash
   ./.venv/bin/python scripts/build_regency_qualitative_index.py
   ```

## What a valid public release must contain

- `site/data/latest/build_manifest.json`
- `site/data/latest/boundaries/province.geojson`
- `site/data/latest/boundaries/regency.geojson`
- `site/data/latest/boundaries/district.geojson`
- `site/data/latest/coverage_report.json`
- `site/data/latest/methodology.json`
- `site/data/latest/search_index.json`
- `site/data/latest/metrics/<level>/summary_all_time.json`
- `site/data/latest/metrics/<level>/month/*.json`
- `site/data/latest/metrics/<level>/trend/*.json`
- `site/data/latest/qualitative_events.json`
- `site/data/latest/geography_review_states.json`
- `site/data/latest/regencies/index.json`

Run the release checks before opening a PR:

```bash
pytest -q
python3 scripts/check_repo_hygiene.py
python3 scripts/validate_public_site_data.py
python3 scripts/validate_readme_links.py README.md
```

## Failure expectations

### Missing Groundsource source

If the expected Groundsource parquet is not present locally, `scripts/build_groundsource_facts.py` writes a manifest with `missing_groundsource_source` instead of pretending a full build succeeded. That state should not be merged as a normal release refresh unless the PR is explicitly about missing-source handling.

### District release gate not met

`scripts/build_groundsource_facts.py` exits when the district release gate is not ready. This is expected behavior when reference geography coverage is below the configured threshold. Do not bypass the gate silently. Either improve reference coverage or make the policy change explicit in the PR.

## Review checklist for data-release PRs

- The manifest still points only to committed files under `site/data/latest/`.
- Coverage and methodology metadata are consistent with the shipped release.
- Search index and boundaries still align to province, regency/city, and district levels.
- Qualitative root assets and regency bundles still match the published contract in `docs/qualitative-contract.md`.
- Any release-gate or methodology change is called out in the PR description.
