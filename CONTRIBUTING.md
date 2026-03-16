# Contributing

Thanks for contributing to `flood-explorer`. This repository packages a reproducible flood-data pipeline and a static public explorer, so most changes affect either the ETL contract, the frontend runtime, or the committed public release assets.

## Environment setup

Use Python 3.13 for geometry-heavy scripts.

```bash
python3.13 -m venv .venv
./.venv/bin/pip install -r requirements.txt
```

For frontend preview:

```bash
python3 -m http.server 4173 --directory site
```

## Run the checks before opening a PR

```bash
pytest -q
python3 scripts/check_repo_hygiene.py
python3 scripts/validate_public_site_data.py
python3 scripts/validate_readme_links.py README.md
```

## Change ETL and frontend safely

### ETL and release-data changes

- Keep Indonesian admin codes as the canonical join keys.
- Do not introduce name-based joins as a fallback.
- Treat `site/data/latest/` as a committed release artifact, not scratch output.
- If you regenerate public assets, validate the release payload before opening a PR.
- Preserve the release-gate behavior for district publication unless the PR explicitly changes that policy.

### Frontend changes

- Keep the runtime manifest-driven. New browser reads should resolve through `build_manifest.json` instead of hard-coded asset paths.
- Update screenshots in the PR when the map, filters, or drill-down behavior changes.
- Keep bilingual copy aligned across `site/translations/id.json` and `site/translations/en.json`.

## PR expectations

- Keep the change summary concrete.
- State the affected surface: `ETL`, `frontend`, `docs`, or `release assets`.
- Include test evidence or validation commands.
- Call out any change to the public data contract, release gate, or methodology copy.
- Include screenshots when UI behavior changes.

## Good issue candidates

- Data quality or coverage problems in committed public assets.
- Regressions in search, drill-down, or metric rendering.
- Documentation gaps around rebuilds, release checks, or reuse flows.
- Small, explicit feature requests that fit the current static explorer scope.

## Scope guardrails

- This repository is a public information product, not an operational emergency-response system.
- Avoid heavy framework rewrites for small fixes.
- Prefer deterministic scripts and explicit file contracts over hidden build magic.
