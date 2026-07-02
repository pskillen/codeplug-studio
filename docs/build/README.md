# Build and deploy

Codeplug Studio is a static Vite SPA deployed to **GitHub Pages** when a **full GitHub release** is published (not a pre-release).

**Base path:** `/codeplug-studio/` (see `vite.config.ts`).

## Local development

```bash
npm install
npm run dev
```

Open the URL Vite prints (typically `http://localhost:5173/codeplug-studio/`).

### Google Drive OAuth (optional)

Copy [`.env.example`](../../.env.example) to `.env.local` and set `VITE_GOOGLE_CLIENT_ID` from a [Google Cloud OAuth 2.0 web client](https://console.cloud.google.com/apis/credentials).

Authorized JavaScript origins must include:

- `http://localhost:5173` (local Vite)
- Your GitHub Pages origin, e.g. `https://pskillen.github.io`

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

## GitHub Pages deploy

[`.github/workflows/pages.yml`](../../.github/workflows/pages.yml) runs on `release: released`.

1. Merge to `main`
2. Publish a **full** GitHub release with tag `v*` (e.g. `v0.1.0`)
3. Workflow builds with `BUILD_ENV=prod` and `BUILD_VERSION` from the tag
4. Site deploys to GitHub Pages

Enable **Pages** in repo settings (source: GitHub Actions) if not already done.

## Build-time variables

| Variable                | Local default            | Prod (release build)                              |
| ----------------------- | ------------------------ | ------------------------------------------------- |
| `BUILD_ENV`             | `local`                  | `prod` (via `pages.yml`)                          |
| `BUILD_VERSION`         | `local`                  | Release tag without leading `v` (via `pages.yml`) |
| `VITE_GOOGLE_CLIENT_ID` | `.env.local` (see above) | GitHub Actions secret `VITE_GOOGLE_CLIENT_ID`     |

`BUILD_ENV` and `BUILD_VERSION` are injected via Vite `define` in `vite.config.ts`. `VITE_GOOGLE_CLIENT_ID` is read from the environment at build time by Vite (`import.meta.env`).

**One-time repo setup (operator):** Settings → Secrets and variables → Actions → add secret `VITE_GOOGLE_CLIENT_ID` with your Google Cloud OAuth web client id. Required for Google Drive Connect on the deployed GitHub Pages site.

Displayed in [`BuildFooter`](../../src/app/components/BuildFooter/BuildFooter.tsx). See [version-number skill](../../.cursor/skills/version-number/SKILL.md).

## Post-deploy check

After publishing a release, open the live site and confirm:

- Footer shows `prod · <semver>` matching the release tag.
- Settings → Google Drive shows **Connect** (not the yellow “not configured” alert) when `VITE_GOOGLE_CLIENT_ID` is set in repo Actions secrets.
