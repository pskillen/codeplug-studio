# Build and deploy

Codeplug Studio is a static Vite SPA deployed to **Cloudflare Pages** via GitHub Actions (direct upload with Wrangler — not the Cloudflare dashboard Git integration).

**Base path:** `/` (custom domain; see `vite.config.ts`).

| Environment | URL                                   | Trigger                       | `BUILD_ENV` | CF branch           |
| ----------- | ------------------------------------- | ----------------------------- | ----------- | ------------------- |
| **prod**    | `https://codeplug.mm9pdy.net`         | Full GitHub release published | `prod`      | `main` (production) |
| **staging** | `https://staging.codeplug.mm9pdy.net` | Pre-release published         | `staging`   | `staging` (preview) |
| **next**    | `https://next.codeplug.mm9pdy.net`    | Push to `main`                | `main`      | `next` (preview)    |
| **dev**     | `https://dev.codeplug.mm9pdy.net`     | Push to `dev`                 | `dev`       | `dev` (preview)     |

## Local development

```bash
npm install
npm run dev
```

Open the URL Vite prints (typically `http://localhost:5173/`).

### Google Drive OAuth (optional)

Copy [`.env.example`](../../.env.example) to `.env.local` and set `VITE_GOOGLE_CLIENT_ID` from a [Google Cloud OAuth 2.0 web client](https://console.cloud.google.com/apis/credentials).

Authorized JavaScript origins must include:

- `http://localhost:5173` (local Vite)
- `https://codeplug.mm9pdy.net` (prod)
- `https://staging.codeplug.mm9pdy.net` (staging)
- `https://next.codeplug.mm9pdy.net` (next)
- `https://dev.codeplug.mm9pdy.net` (dev)

Enable the **Google Drive API** for the project. Scope used by Studio: `https://www.googleapis.com/auth/drive` (folder browse + YAML read/write). Tokens stay in browser localStorage only — see [google-drive.md](../features/import-export/google-drive.md).

### Line endings

The repository stores **LF** for text files (`.gitattributes`). Prettier follows the platform: **CRLF on Windows**, **LF on Linux/macOS and in CI** (`prettier.config.js`).

| Platform           | Git checkout                     | Prettier | Committed to Git |
| ------------------ | -------------------------------- | -------- | ---------------- |
| Windows            | CRLF (with `core.autocrlf=true`) | CRLF     | LF               |
| Linux / macOS / CI | LF                               | LF       | LF               |

On Windows, use `core.autocrlf=true` (the Git for Windows default). If line endings were wrong before `.gitattributes` landed, run once:

```bash
git add --renormalize .
git status
```

If `git status` still shows phantom whole-file edits with empty diffs, run `git restore .` after renormalizing.

## Scripts

| Script                            | Purpose                       |
| --------------------------------- | ----------------------------- |
| `npm run dev`                     | Vite dev server               |
| `npm run build`                   | Typecheck + production bundle |
| `npm run test`                    | Vitest unit tests             |
| `npm run lint`                    | ESLint                        |
| `npm run format` / `format:check` | Prettier                      |

## Documentation map

| Doc                                                                  | Contents                                    |
| -------------------------------------------------------------------- | ------------------------------------------- |
| [testing/](testing/README.md)                                        | Test layers, mapping strategy, CI alignment |
| [version-number skill](../../.cursor/skills/version-number/SKILL.md) | Footer build info                           |

## CI

Pull requests and pushes to `main` run [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml):

`format:check` → `lint` → `test` → `build` → `e2e` (Playwright)

## Cursor Approval Agent

PR auto-approval is governed by repository policy files discovered by the [Cursor Approval Agent](https://cursor.com/docs/approval-agents). Bugbot is **not** used. **GitHub CI status is not an approval gate** — branch protection blocks merge when required checks fail, and CI is often still pending when the Approval Agent runs.

| File                                                                                 | Role                                                                                                                   |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| [`APPROVAL_POLICY.md`](../../APPROVAL_POLICY.md)                                     | Default permissive policy (auto-approve when no hard trigger applies; architecture red flags escalate to human review) |
| [`.cursor/approval-policies/ROUTING.md`](../../.cursor/approval-policies/ROUTING.md) | Routes stricter policies for workflows, governance, and boundary rules                                                 |
| [`.github/workflows/APPROVAL_POLICY.md`](../../.github/workflows/APPROVAL_POLICY.md) | Always human review for deploy/CI workflow changes                                                                     |
| [`.cursor/rules/APPROVAL_POLICY.md`](../../.cursor/rules/APPROVAL_POLICY.md)         | Always human review for constitutional `.mdc` boundary rules                                                           |

### Dashboard setup (one-time)

In the **Approval Agents** dashboard for `pskillen/codeplug-studio`:

| Setting                     | Value                                                                                                                                                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Triggers                    | PR opened + PR pushed/updated                                                                                                                                                                                                   |
| Use Bugbot Review Context   | **Off**                                                                                                                                                                                                                         |
| Use Security Review Context | **Off** (unless Security Agents are enabled later)                                                                                                                                                                              |
| Use Risk Score              | **On**                                                                                                                                                                                                                          |
| Maximum Risk for Approval   | **Medium** or **High**                                                                                                                                                                                                          |
| Primary action              | Approve PR                                                                                                                                                                                                                      |
| Custom prompt               | Follow repo `APPROVAL_POLICY.md` files. Do **not** wait for or require GitHub CI check status. Approve when no stricter nested policy blocks approval and risk is within threshold. Do not wait for Bugbot — it is not enabled. |

### Post-merge verification

After merging policy files, confirm behaviour manually:

1. Docs-only PR with no hard triggers → should auto-approve (even while CI is pending).
2. PR touching `.github/workflows/ci.yml` → should **not** auto-approve.
3. PR touching `.cursor/rules/layer-boundaries.mdc` → should **not** auto-approve.

## Cloudflare Pages deploy

Deploy workflows call the reusable [`.github/workflows/cloudflare-pages.yaml`](../../.github/workflows/cloudflare-pages.yaml), which runs `npm ci`, `npm run build`, then `wrangler pages deploy` (project name and static output from [`wrangler.toml`](../../wrangler.toml)) to the `codeplug-studio` Cloudflare Pages project. Pages Functions in [`functions/`](../../functions/) deploy with the same upload on every environment branch (dev / next / staging / prod).

| Workflow                                               | Trigger                | `BUILD_ENV` |
| ------------------------------------------------------ | ---------------------- | ----------- |
| [`prod.yaml`](../../.github/workflows/prod.yaml)       | `release: released`    | `prod`      |
| [`staging.yaml`](../../.github/workflows/staging.yaml) | `release: prereleased` | `staging`   |
| [`main.yaml`](../../.github/workflows/main.yaml)       | `push` to `main`       | `main`      |
| [`dev.yaml`](../../.github/workflows/dev.yaml)         | `push` to `dev`        | `dev`       |

**Production** (`prod.yaml`) deploys with `--branch=main` (the CF production branch). Release workflows check out a tag (detached `HEAD`); omitting `--branch` creates a throwaway preview on branch `HEAD` instead of production.

**Preview** workflows pass `cloudflare_branch` (`staging`, `next`, or `dev`) for pre-production hostnames. Do not use `--branch=main` on continuous `main` pushes — that slot is production only.

### SPA fallback (path-based routing)

The app uses `createBrowserRouter` with path URLs (`/library/channels`, not `/#/library/channels`). Deep links and hard refresh must serve `index.html` for client routes.

- **Cloudflare default:** when the build has no top-level `404.html`, Pages treats the project as an SPA and serves `index.html` for unmatched paths.
- **Explicit rewrite:** [`public/_redirects`](../../public/_redirects) (`/* /index.html 200`) is copied into `dist/` by Vite and deployed with every build — belt-and-suspenders for all environments (prod, staging, next, dev).

Local check: `npm run build && npm run preview`, then open `/library/channels` or `/debug` directly in the browser.

### Pages Functions (CORS bridges)

IRTS and RepeaterBook upstream feeds are not browser-CORS accessible (RepeaterBook also requires a server-set User-Agent). Studio ships edge proxies gated by a **shared origin allowlist** in [`functions/lib/codeplugOrigin.ts`](../../functions/lib/codeplugOrigin.ts):

| Allowed origin                        | Notes                                         |
| ------------------------------------- | --------------------------------------------- |
| `https://codeplug.mm9pdy.net`         | prod apex (wildcard `*.` does not cover apex) |
| `https://dev.codeplug.mm9pdy.net`     | dev                                           |
| `https://next.codeplug.mm9pdy.net`    | next                                          |
| `https://staging.codeplug.mm9pdy.net` | staging                                       |
| `http://localhost:5173`               | local Vite against deployed functions         |

Requests without a matching `Origin` or `Referer` receive **403**. Responses mirror the allowed origin in `Access-Control-Allow-Origin` (never `*`).

| Path                           | Source                                                                               | Notes                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `GET /api/irts/repeaters`      | [`functions/api/irts/repeaters.ts`](../../functions/api/irts/repeaters.ts)           | Proxies `irts.ie` Anytone CSV; no secrets                                                 |
| `GET /api/repeaterbook/export` | [`functions/api/repeaterbook/export.ts`](../../functions/api/repeaterbook/export.ts) | Proxies RepeaterBook export; forwards per-user `X-RB-App-Token`; sets approved User-Agent |

- **Deployed:** bundled with each `wrangler pages deploy` — same commit as the SPA on that CF branch.
- **Local dev:** Vite proxies `/api/irts/repeaters` and `/api/repeaterbook/export` to upstream (`vite.config.ts`); RepeaterBook dev proxy injects User-Agent. No Wrangler required for day-to-day UI work.
- **IaC:** [`wrangler.toml`](../../wrangler.toml) is the source of truth for project name and `pages_build_output_dir`. Avoid editing overlapping fields in the Cloudflare dashboard once this file is in use.

Pages Functions are matched before the SPA `_redirects` catch-all; no `_routes.json` is required for `/api/*`.

### Operator setup (one-time)

1. Create a Cloudflare Pages project named `codeplug-studio` via **Direct Upload** — do not connect GitHub in the CF dashboard.
2. Map custom domains: `codeplug.mm9pdy.net` → production; branch aliases for `staging`, `next`, and `dev` preview branches.
3. Add GitHub Actions secrets under **Settings → Secrets and variables → Actions**:

| Secret                      | Purpose                                                           |
| --------------------------- | ----------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`      | API token with **Cloudflare Pages — Edit** (and account read)     |
| `CLOUDFLARE_ACCOUNT_ID`     | Cloudflare account id                                             |
| `GOOGLE_OAUTH_CLIENT_ID`    | Google OAuth web client id for Drive Connect on deployed builds   |
| `GA_MEASUREMENT_ID`         | GA4 measurement ID for **production** deploys (`prod`)            |
| `GA_MEASUREMENT_ID_PREPROD` | GA4 measurement ID for **staging**, **next**, and **dev** deploys |

Create the API token in the Cloudflare dashboard with account-scoped **Cloudflare Pages → Edit** permission.

### Google Analytics 4 (optional)

Anonymous page-view analytics is consent-gated in the SPA. Deployed builds receive a measurement ID at compile time; local dev omits it unless you set `VITE_GA_MEASUREMENT_ID` in `.env.local`.

1. Create **two** GA4 web data streams (separate properties keep prod reports clean):
   - **Prod** — `https://codeplug.mm9pdy.net`
   - **Pre-prod** — `dev`, `next`, and `staging` hostnames (`dev.codeplug.mm9pdy.net`, `next.codeplug.mm9pdy.net`, `staging.codeplug.mm9pdy.net`)
2. Copy each Measurement ID (`G-XXXXXXXX`).
3. Add GitHub Actions secrets:
   - `GA_MEASUREMENT_ID` — prod stream (injected when `build_env` is `prod`)
   - `GA_MEASUREMENT_ID_PREPROD` — pre-prod stream (injected for `staging`, `main`, and `dev` deploy workflows)
4. In GA admin for both streams: review data retention, disable ads personalization signals if desired.
5. After deploy: accept analytics cookies on the live site → confirm events in the matching property's Realtime report.

See [analytics feature docs](../features/analytics/README.md) for what is and is not collected.

## Build-time variables

| Variable                 | Local default            | Deployed builds (via workflows)                                      |
| ------------------------ | ------------------------ | -------------------------------------------------------------------- |
| `BUILD_ENV`              | `local`                  | `prod`, `staging`, `main`, or `dev`                                  |
| `BUILD_VERSION`          | `local`                  | Release tag or commit SHA (leading `v` stripped)                     |
| `VITE_GOOGLE_CLIENT_ID`  | `.env.local` (see above) | GitHub Actions secret `GOOGLE_OAUTH_CLIENT_ID`                       |
| `VITE_GA_MEASUREMENT_ID` | `.env.local` (optional)  | `GA_MEASUREMENT_ID` (prod) or `GA_MEASUREMENT_ID_PREPROD` (pre-prod) |

`BUILD_ENV` and `BUILD_VERSION` are injected via Vite `define` in `vite.config.ts`. `VITE_GOOGLE_CLIENT_ID` and `VITE_GA_MEASUREMENT_ID` are read from the environment at build time by Vite (`import.meta.env`).

Displayed in [`BuildFooter`](../../src/app/components/BuildFooter/BuildFooter.tsx). See [version-number skill](../../.cursor/skills/version-number/SKILL.md).

## Post-deploy check

After a deploy, open the live site and confirm:

- Footer shows the expected environment and version (e.g. `prod · 0.2.0` after a full release).
- Hard refresh on nested routes (e.g. `/library/channels`, `/settings`, `/debug`) loads the SPA — no 404 from the host.
- Settings → Google Drive shows **Connect** (not the yellow “not configured” alert) when `GOOGLE_OAUTH_CLIENT_ID` is set in repo Actions secrets.
