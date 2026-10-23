# Cloudflare deployment

Run Wrangler through `bash scripts/wrangler.sh` from this checkout. The wrapper
pins the CLI version and selects macOS Keychain storage across terminal and agent
sessions. Credentials belong in Keychain, never in this repository or chat.

Initial authorization (or recovery after revocation/refresh failure):

```sh
bash scripts/wrangler.sh login --use-keyring --scopes account:read user:read pages:write
```

Complete Cloudflare's browser authorization, then verify access:

```sh
bash scripts/wrangler.sh whoami
bash scripts/wrangler.sh pages project list
```

The OAuth login includes offline access so Wrangler can renew short-lived access
tokens. Reuse it; do not start login for every task. Revocation or an invalid
refresh token can still require a new browser authorization. API-token environment
variables override OAuth; check their presence without printing their contents if
authentication behaves unexpectedly.

The static publish directory is `site/`. Before deploying, verify the account and
existing Pages project owning `flood.faizkrisnadi.com`; do not create a replacement
project or change DNS to work around missing access.

Verified target: account `8696dea3eebe1ad3490426a695715556`, Pages project
`peta-banjir-indonesia`, production branch `main`. This is a direct-upload project;
pushing GitHub does not trigger publishing. Publish a clean committed checkout:

```sh
bash scripts/deploy.sh
```

The script checks authentication, pins the account/project, and attaches the Git
commit to the deployment. It intentionally publishes production only when invoked.

After publishing, verify the release-specific assets and changed behavior on
`https://flood.faizkrisnadi.com`. A Git push alone does not confirm deployment.
