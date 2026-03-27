# Regency Release Runbook

Use this runbook when a new tranche of regency qualitative bundles is ready for the public site.

## Inputs

The committed site artifact expects three qualitative entrypoints:

- `site/data/latest/qualitative_events.json`
- `site/data/latest/geography_review_states.json`
- `site/data/latest/regencies/*.json`

The regency directory should contain paired files:

- `*_qualitative_events.json`
- `*_geography_review_states.json`

## Release sequence

1. Refresh the global qualitative exports.

   Put the latest `qualitative_events.json` and `geography_review_states.json` into the packaging source tree, then run:

   ```bash
   ./.venv/bin/python scripts/build_public_site_data.py
   ```

2. Refresh regency bundles.

   Add or update the regency bundle files under `site/data/latest/regencies/` or under the processed packaging source if you are running the full pipeline.

3. Rebuild the regency index.

   ```bash
   ./.venv/bin/python scripts/build_regency_qualitative_index.py
   ```

4. Validate the release artifact.

   ```bash
   python3 -m pytest tests/test_public_site_data_validation.py -q
   python3 scripts/validate_public_site_data.py
   ```

## Expected review behavior

- Covered regencies should have both an events bundle and a review-states bundle.
- Uncovered regencies should simply not appear in `regencies/index.json`.
- Global qualitative exports remain the fallback layer for province, district, and uncovered regency selections.

## Common failure cases

- `build_manifest.json.qualitative` points to a file that was not committed.
- `regencies/index.json` contains duplicate `admin_code` or `slug` values.
- A bundle file exists but lacks the minimum fields required by the browser: source metadata for events, and `public_state` for review states.
