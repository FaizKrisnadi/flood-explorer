# Qualitative Contract

The static site treats qualitative evidence as a first-class data layer. The browser discovers those assets through `site/data/latest/build_manifest.json`, not through hardcoded file names.

## Manifest contract

`build_manifest.json.qualitative` must contain:

- `global_events_path`
- `global_states_path`
- `regency_index_path`
- `regency_assets_base_path`
- `supported_levels`
- `route_version`

The current contract values are:

- global events: `qualitative_events.json`
- global review states: `geography_review_states.json`
- regency index: `regencies/index.json`
- regency bundle root: `regencies/`
- supported levels: `province`, `regency`, `district`

## Regency index schema

`site/data/latest/regencies/index.json` is the registry for on-demand regency bundles. Each row must include:

- `admin_code`
- `admin_level`
- `province_code`
- `slug`
- `events_path`
- `states_path`

Optional but recommended fields:

- `updated_at`
- `public_state_summary`

The index builder currently emits one row per regency bundle and uses relative paths rooted at `site/data/latest/`.

## Fallback order

The runtime selection logic follows one precedence rule:

1. Load the global qualitative exports at bootstrap.
2. When a regency is selected, look it up in `regencies/index.json`.
3. If a dedicated regency bundle exists, load it and use it for that regency route.
4. If no dedicated bundle exists, fall back to the global exports only.

Dedicated regency bundles win over global data for the same regency-period. The browser should not merge duplicate records from both sources.

## Public empty states

The frontend uses four public review states:

- `not_reviewed_yet`
- `reviewed_but_no_publishable_report`
- `has_featured_report_only`
- `has_featured_report_and_more`

Two of those states are explicitly non-negative:

- `not_reviewed_yet` means no review decision has been published yet.
- `reviewed_but_no_publishable_report` means the period was reviewed, but the current release has no publishable qualitative record.

Neither state should be rendered as evidence that flooding did not happen.
