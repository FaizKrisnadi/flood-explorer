# Data freshness and report provenance

The explorer serves a versioned, committed static dataset. Faster interface updates do not add newer flood records. Treat three dates separately:

- **Coverage end:** the last event month represented by the packaged data (currently February 2026, derived from the manifest's month assets). This is an observed coverage limit, not proof that all events through that month are recorded.
- **Generated at:** `build_manifest.json.generated_at` records when that release was built. The currently committed manifest reports 27 March 2026. A new frontend build must not replace this with today's date.
- **Checked at:** when a maintainer last checked upstream availability or ran an audit. Record what was checked and its outcome. A provenance audit timestamp does not mean the underlying articles or upstream dataset were checked live.

## Current upstream pin

`scripts/fetch_sources.py` pins Groundsource to Zenodo record `18647054`, file `groundsource_2026.parquet`, through `https://zenodo.org/api/records/18647054/files/groundsource_2026.parquet/content`. The read-only metadata checker contacted that official API during this refresh: publication date `2026-02-15`, modified `2026-03-12T08:32:52.809799+00:00`, checksum `md5:cd1b5de6508f7aad8e1d1d0dd4cecea6`, size `667122400` bytes. The API omitted `metadata.version` and supplied a `/versions/latest` resolver link; the default checker preserves that link and reports comparison as unknown. An explicit metadata-only `--check-latest` request resolved that relation to the same record ID and checksum, so the pin matches the latest version reported by this record's version history at the check. This does not establish global latest status across other Groundsource distributions. These metadata checks do not verify dataset coverage or article content. Before a data refresh, inspect the official Zenodo record, its version history, metadata, licence, checksum and date coverage. Record those findings with the release. Change the pin only deliberately and compare coverage and counts against the previous release.

Run the metadata-only check without downloading the parquet:

```bash
python3 scripts/check_groundsource_release.py --check-latest --output work/groundsource-metadata-check.json
python3 scripts/check_groundsource_release.py --metadata-file work/zenodo-api-response.json
```

`--metadata-file` accepts an original saved Zenodo API response, not the checker summary. With `--check-latest`, one additional metadata request resolves the latest-version relation; it is restricted to official HTTPS Zenodo record API paths, including redirects. Without that flag, current-version comparison remains unknown. Network errors, missing required metadata and record-ID mismatches produce explicit failure results and a nonzero exit. The checker never changes public assets or the pinned source. The result includes the actual execution timestamp; do not replace it with a nominal planning date.

Follow [the maintainer release procedure](maintainer-release.md) to inspect, fetch, build reference geography, build facts, package assets and rebuild the qualitative index. Missing Groundsource data or a failed geography release gate must remain explicit failures. Keep the previous valid static release until the replacement has passed checks.

## Report-source screening

Run the non-destructive audit:

```bash
python3 scripts/audit_report_sources.py
python3 scripts/audit_report_sources.py --output work/report-source-audit.json
```

The audit reads root qualitative events and all dedicated regency event bundles. It rejects missing or malformed URLs, placeholder domains, generic publisher homepages and generic `/news` or `/berita` section links. Supporting records are checked recursively; an invalid supporting source withholds the parent from display. Raw records remain available for correction and review.

`site/report-integrity.js` applies the same eligibility policy in the browser. Load it before `app.js` and use `FloodReportIntegrity.filterRecords(records)` on both global and lazy-loaded regency arrays. A helper failure must not accidentally publish unscreened records.

Passing URL screening means a record has a plausible direct source link. It does **not** establish that the article exists, describes the claimed event, supports the summary, or has been editorially reviewed. Those checks need original-source reading. Media URLs are outside this audit's scope. Review-state files may describe the earlier curation inventory, so the interface must derive visible report availability from the screened records and avoid promising a featured report that was withheld.

The initial audit found 132 top-level record occurrences across 55 files: 100 withheld for placeholder sources and 32 URL-eligible. Counts include repetitions between root exports and regency bundles; they are not unique flood-event counts.

For a release containing corrected qualitative sources, require the strict audit to succeed:

```bash
python3 scripts/audit_report_sources.py --strict
```

The strict command currently fails because the preserved raw release includes placeholder records. Browser screening contains that problem without claiming that the historical source inventory has been repaired.

## Validation and release comparison

Run the existing repository checks plus the source audit:

```bash
pytest -q
python3 scripts/check_repo_hygiene.py
python3 scripts/validate_public_site_data.py
python3 scripts/validate_readme_links.py README.md
python3 scripts/audit_report_sources.py
```

Compare old and new month coverage, event totals at each geography level, boundary/search alignment, missing assets, report eligibility and methodology metadata. Check a location with reports, one whose reports were withheld, and one with no reviewed reports in desktop and mobile browsers. Preserve the distinction between missing evidence and no flooding.

No automatic upstream update or scheduled publishing job is configured by this document. A future scheduled checker should report a confirmed new upstream version, a failed check or required action; it should not silently rebuild against a changing unpinned input or alter dates to imply freshness.
