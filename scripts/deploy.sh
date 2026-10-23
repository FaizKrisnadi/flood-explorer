#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -n "$(git status --porcelain)" ]]; then
  echo 'Commit or stash local changes before publishing.' >&2
  exit 1
fi
export CLOUDFLARE_ACCOUNT_ID=8696dea3eebe1ad3490426a695715556
bash scripts/wrangler.sh whoami
exec bash scripts/wrangler.sh pages deploy site \
  --project-name peta-banjir-indonesia --branch main \
  --commit-hash "$(git rev-parse HEAD)" --commit-dirty=false
