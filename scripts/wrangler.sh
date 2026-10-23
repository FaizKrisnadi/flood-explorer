#!/usr/bin/env bash
set -euo pipefail

# Share Wrangler's refreshable macOS Keychain login across local agent sessions.
# API-token environment variables retain Wrangler's normal precedence.
export CLOUDFLARE_AUTH_USE_KEYRING=true
cd "$(dirname "$0")/.."
exec npx --yes wrangler@4.152.0 "$@"
