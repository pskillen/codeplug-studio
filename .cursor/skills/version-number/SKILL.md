---
name: version-number
description: >-
  Display build environment and version in page footers for Codeplug Studio SPA.
  Covers Vite define injection at build time, local fallbacks, and footer UI.
  Use when adding build info, wiring deploy workflows, or debugging which release
  a tab is running.
---

# Build version and environment in footer

Codeplug Studio displays **build environment** and **build version** in a muted
page footer. Values are baked in at **build time** via Vite `define` in
`vite.config.ts`. Local dev builds fall back to `"local"` without configuration.

Pair with [git-workflow](../git-workflow/SKILL.md) for releases and
[docs/build/README.md](../../../docs/build/README.md).

---

## Layout

| Path | Role |
| --- | --- |
| `vite.config.ts` | `define` for `__BUILD_ENV__` / `__BUILD_VERSION__` |
| `src/vite-env.d.ts` | Global declarations |
| `src/app/components/BuildFooter/BuildFooter.tsx` | Footer UI |
| `src/app/App.tsx` | Mounts footer on every route |
| `.github/workflows/cloudflare-pages.yaml` | Reusable build + deploy |
| `.github/workflows/prod.yaml` | Prod env on full release |
| `.github/workflows/staging.yaml` | Staging env on pre-release |
| `.github/workflows/main.yaml` | Dev env on push to `main` |

Site base path: `/` (see `vite.config.ts`).

---

## Values

| Environment | `BUILD_ENV` | `BUILD_VERSION` | Trigger |
| --- | --- | --- | --- |
| local | `local` | `local` | `npm run dev` |
| dev | `dev` | commit SHA | push to `main` |
| staging | `staging` | SemVer from tag (leading `v` stripped) | pre-release publish |
| prod | `prod` | SemVer from tag (leading `v` stripped) | full release publish |

---

## Local smoke test

```bash
npm run dev          # footer: local · local
BUILD_ENV=prod BUILD_VERSION=v0.1.0 npm run build && npm run preview
BUILD_ENV=staging BUILD_VERSION=0.2.0-rc.1 npm run build && npm run preview
```

---

## Deploy workflows

Build env is set in [`.github/workflows/cloudflare-pages.yaml`](../../../.github/workflows/cloudflare-pages.yaml):

```yaml
env:
  BUILD_ENV: ${{ inputs.build_env }}
  BUILD_VERSION: ${{ inputs.build_version }}
```

After publishing a full release, verify footer on `https://codeplug.pskillen.xyz` shows `prod · <semver>`.
