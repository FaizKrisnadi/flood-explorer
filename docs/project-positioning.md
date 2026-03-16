# Project Positioning for Codex for Open Source

## Public-interest rationale

`flood-explorer` is an open, reproducible flood-data publishing pipeline and static explorer for Indonesia. It combines Groundsource flood footprints, Indonesian administrative geography, release gating, and static browser delivery into a public artifact that can be audited, rebuilt, and reused by civic-tech teams, researchers, journalists, NGOs, and public-sector analysts.

The project matters because flood information products are often difficult to audit: joins are opaque, coverage gaps are hidden, and deployment stacks are heavier than necessary for public-interest publishing. This repository keeps the pipeline visible and ships manifest-driven static assets that can be served cheaply.

## Maintainer burden today

- Triaging issues about data quality, release coverage, and frontend regressions.
- Reviewing PRs that touch ETL logic, browser-consumed assets, and public methodology wording.
- Validating that `site/data/latest/` stays internally consistent after regeneration.
- Keeping contributor docs, release notes, and caveat language aligned with the shipped artifact.
- Reviewing changes that could weaken release gating, geography joins, or public deployment safety.

## Where Codex would help

- Issue triage and duplicate detection across bugs, data quality reports, and docs requests.
- PR review for changes in `scripts/`, `site/`, and committed release assets.
- Regression checks against the public data contract and geography coverage assumptions.
- Drafting release notes and contributor-facing documentation updates.
- Security-focused review for changes that affect public asset delivery or CI/workflow configuration.

## Application-ready language

### Why this repository qualifies

This repository is an open, reproducible flood-data publishing pipeline and static explorer for Indonesia. It packages ETL, geography QA, release gating, and static delivery into a maintainable public artifact for civic-tech and research use.

### What maintenance work is repetitive

The repetitive work is issue triage, PR review, release validation, data-contract checking, and documentation upkeep around public data releases and methodology changes.

### How API credits would be used

Credits would be used for issue triage, PR review, regression checks on geography and data-contract changes, release-note drafting, and contributor-documentation upkeep.

### Codex Security fit

Codex Security is useful but secondary. The repo does not handle secrets-heavy production infrastructure, but it would still help review contributor changes that touch ETL scripts, browser-consumed release assets, and GitHub workflows.
