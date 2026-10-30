# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project uses [Semantic Versioning](https://semver.org/) as a release
reference even though public data releases may be published independently of
application changes.

## [Unreleased]

### Added

- OSS maintainer scaffolding for contribution, security, conduct, citation, and release validation.
- Deterministic repo checks for hygiene, README links, and committed public site payload integrity.
- Public site data validator now recomputes `summary_all_time` from month shards and fails on disagreement, and flags month shards holding records that the manifest month list omits.
- Qualitative build gate now counts source-link eligibility (the same screen the browser applies fail-closed) when choosing featured records and review states.
- Rebuild manifest records `carryover_from_previous_release` when qualitative assets are kept from a prior release because processed inputs were missing.

### Changed

- README repositioned around reproducible flood-data infrastructure and a static public explorer.

### Fixed

- Date-only labels (trend tooltips, qualitative report dates) no longer shift one day for viewers west of UTC; absolute timestamps keep viewer-local rendering.
