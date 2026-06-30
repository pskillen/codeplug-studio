# Build and deploy

Codeplug Studio is a static Vite SPA deployed to **GitHub Pages** when a **full GitHub release** is published (not a pre-release).

**Base path:** `/codeplug-studio/` (see `vite.config.ts`).

## Local development

```bash
npm install
npm run dev
```

Open the URL Vite prints (typically `http://localhost:5173/codeplug-studio/`).

## Scripts

| Script                            | Purpose                       |
| --------------------------------- | ----------------------------- |
| `npm run dev`                     | Vite dev server               |
| `npm run build`                   | Typecheck + production bundle |
| `npm run test`                    | Vitest unit tests             |
| `npm run lint`                    | ESLint                        |
| `npm run format` / `format:check` | Prettier                      |

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

Injected via Vite `define` in `vite.config.ts`:

| Variable        | Local default | Prod (release build)            |
| --------------- | ------------- | ------------------------------- |
| `BUILD_ENV`     | `local`       | `prod`                          |
| `BUILD_VERSION` | `local`       | Release tag without leading `v` |

Displayed in [`BuildFooter`](../../src/app/components/BuildFooter/BuildFooter.tsx). See [version-number skill](../../.cursor/skills/version-number/SKILL.md).

## Post-deploy check

After publishing a release, open the live site and confirm the footer shows `prod · <semver>` matching the release tag.
