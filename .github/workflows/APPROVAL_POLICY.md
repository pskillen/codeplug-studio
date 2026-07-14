# Approval policy — GitHub workflows

**Always require human review.** Do not auto-approve PRs that change files in this directory.

## Scope

Changes to any workflow in `.github/workflows/`, including:

- [`ci.yml`](ci.yml) — PR CI (`format:check`, `lint`, `test`, `build`, e2e)
- [`cloudflare-pages.yaml`](cloudflare-pages.yaml) — reusable Pages deploy (secrets, OAuth client ID, GA measurement IDs)
- [`main.yaml`](main.yaml), [`dev.yaml`](dev.yaml), [`staging.yaml`](staging.yaml), [`prod.yaml`](prod.yaml) — environment deploy triggers

## Rationale

These workflows gate deploys to `https://codeplug.mm9pdy.net` and inject build-time secrets (`CLOUDFLARE_API_TOKEN`, `GOOGLE_OAUTH_CLIENT_ID`, GA measurement IDs). Any new workflow that references `secrets.*`, Cloudflare tokens, OAuth client IDs, or deploy branches also requires human review.

## Auto-approve

Never auto-approve changes under `.github/workflows/` regardless of GitHub check status on the PR.
