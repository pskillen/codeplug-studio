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

`format:check` → `lint` → `test` → `build`

## Cloudflare Pages deploy

Deploy workflows call the reusable [`.github/workflows/cloudflare-pages.yaml`](../../.github/workflows/cloudflare-pages.yaml), which runs `npm ci`, `npm run build`, then `wrangler pages deploy dist` to the `codeplug-studio` Cloudflare Pages project.

| Workflow                                               | Trigger                | `BUILD_ENV` |
| ------------------------------------------------------ | ---------------------- | ----------- |
| [`prod.yaml`](../../.github/workflows/prod.yaml)       | `release: released`    | `prod`      |
| [`staging.yaml`](../../.github/workflows/staging.yaml) | `release: prereleased` | `staging`   |
| [`main.yaml`](../../.github/workflows/main.yaml)       | `push` to `main`       | `main`      |
| [`dev.yaml`](../../.github/workflows/dev.yaml)         | `push` to `dev`        | `dev`       |

**Production** (`prod.yaml`) deploys with `--branch=main` (the CF production branch). Release workflows check out a tag (detached `HEAD`); omitting `--branch` creates a throwaway preview on branch `HEAD` instead of production.

**Preview** workflows pass `cloudflare_branch` (`staging`, `next`, or `dev`) for pre-production hostnames. Do not use `--branch=main` on continuous `main` pushes — that slot is production only.

### Operator setup (one-time)

1. Create a Cloudflare Pages project named `codeplug-studio` via **Direct Upload** — do not connect GitHub in the CF dashboard.
2. Map custom domains: `codeplug.mm9pdy.net` → production; branch aliases for `staging`, `next`, and `dev` preview branches.
3. Add GitHub Actions secrets under **Settings → Secrets and variables → Actions**:

| Secret                   | Purpose                                                         |
| ------------------------ | --------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`   | API token with **Cloudflare Pages — Edit** (and account read)   |
| `CLOUDFLARE_ACCOUNT_ID`  | Cloudflare account id                                           |
| `GOOGLE_OAUTH_CLIENT_ID` | Google OAuth web client id for Drive Connect on deployed builds |

Create the API token in the Cloudflare dashboard with account-scoped **Cloudflare Pages → Edit** permission.

## Build-time variables

| Variable                | Local default            | Deployed builds (via workflows)                  |
| ----------------------- | ------------------------ | ------------------------------------------------ |
| `BUILD_ENV`             | `local`                  | `prod`, `staging`, `main`, or `dev`              |
| `BUILD_VERSION`         | `local`                  | Release tag or commit SHA (leading `v` stripped) |
| `VITE_GOOGLE_CLIENT_ID` | `.env.local` (see above) | GitHub Actions secret `GOOGLE_OAUTH_CLIENT_ID`   |

`BUILD_ENV` and `BUILD_VERSION` are injected via Vite `define` in `vite.config.ts`. `VITE_GOOGLE_CLIENT_ID` is read from the environment at build time by Vite (`import.meta.env`).

Displayed in [`BuildFooter`](../../src/app/components/BuildFooter/BuildFooter.tsx). See [version-number skill](../../.cursor/skills/version-number/SKILL.md).

## Post-deploy check

After a deploy, open the live site and confirm:

- Footer shows the expected environment and version (e.g. `prod · 0.2.0` after a full release).
- Settings → Google Drive shows **Connect** (not the yellow “not configured” alert) when `GOOGLE_OAUTH_CLIENT_ID` is set in repo Actions secrets.
