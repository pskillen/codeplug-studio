# Build and deploy

Codeplug Studio is a static Vite SPA deployed to **Cloudflare Pages** via GitHub Actions (direct upload with Wrangler — not the Cloudflare dashboard Git integration).

**Base path:** `/` (custom domain; see `vite.config.ts`).

| Environment | URL                                     | Trigger                       |
| ----------- | --------------------------------------- | ----------------------------- |
| **prod**    | `https://codeplug.pskillen.xyz`         | Full GitHub release published |
| **staging** | `https://staging.codeplug.pskillen.xyz` | Pre-release published         |
| **next**    | `https://next.codeplug.pskillen.xyz`    | Push to `main`                |
| **dev**     | `https://dev.codeplug.pskillen.xyz`     | Push to `dev`                 |

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
- `https://codeplug.pskillen.xyz` (prod)
- `https://staging.codeplug.pskillen.xyz` (staging)
- `https://next.codeplug.pskillen.xyz` (next)
- `https://dev.codeplug.pskillen.xyz` (dev)

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
| [`next.yaml`](../../.github/workflows/next.yaml)       | `push` to `main`       | `next`      |
| [`dev.yaml`](../../.github/workflows/dev.yaml)         | `push` to `dev`        | `dev`       |

**Production** deploys omit `--branch` (production slot on the Pages project). **Staging**, **next**, and **dev** deploy as preview branches (`staging`, `next`, and `dev` respectively), mapped to custom subdomains in Cloudflare.

### Operator setup (one-time)

1. Create a Cloudflare Pages project named `codeplug-studio` via **Direct Upload** — do not connect GitHub in the CF dashboard.
2. Map custom domains: `codeplug.pskillen.xyz` → production; branch aliases for `staging`, `next`, and `dev` preview branches.
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
| `BUILD_ENV`             | `local`                  | `prod`, `staging`, `next`, or `dev`              |
| `BUILD_VERSION`         | `local`                  | Release tag or commit SHA (leading `v` stripped) |
| `VITE_GOOGLE_CLIENT_ID` | `.env.local` (see above) | GitHub Actions secret `GOOGLE_OAUTH_CLIENT_ID`   |

`BUILD_ENV` and `BUILD_VERSION` are injected via Vite `define` in `vite.config.ts`. `VITE_GOOGLE_CLIENT_ID` is read from the environment at build time by Vite (`import.meta.env`).

Displayed in [`BuildFooter`](../../src/app/components/BuildFooter/BuildFooter.tsx). See [version-number skill](../../.cursor/skills/version-number/SKILL.md).

## Post-deploy check

After a deploy, open the live site and confirm:

- Footer shows the expected environment and version (e.g. `prod · 0.2.0` after a full release).
- Settings → Google Drive shows **Connect** (not the yellow “not configured” alert) when `GOOGLE_OAUTH_CLIENT_ID` is set in repo Actions secrets.
