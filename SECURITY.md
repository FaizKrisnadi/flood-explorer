# Security Policy

## Reporting a vulnerability

Please report suspected vulnerabilities privately by emailing `0123mfk@gmail.com` with:

- a short description of the issue,
- affected files or release assets,
- reproduction steps or proof of concept,
- impact assessment if known.

Do not open a public GitHub issue for undisclosed security problems.

## Response expectations

- Initial acknowledgement target: within 7 days.
- Triage target after reproduction is confirmed: within 14 days.
- Remediation timing depends on severity, exploitability, and whether public release assets need to be regenerated.

## Supported scope

Security review is most relevant for:

- contribution changes under `scripts/`,
- changes to committed public payloads under `site/data/latest/`,
- frontend changes that alter browser-loaded asset paths, rendering logic, or public deployment behavior,
- GitHub workflow or release-integrity automation changes.

## Out of scope

- Vulnerabilities requiring access to local raw datasets that are intentionally not published in this repo.
- Reports against third-party source systems outside this repository.

## Product safety note

This repository publishes public information artifacts. The dashboard must not be used as an operational emergency-response or early-warning system.
