---
name: version-number
description: >-
  Display build environment and version in page footers for Codeplug Studio SPA.
  Covers Vite define injection at build time, local fallbacks, and footer UI.
  Use when adding build info, wiring pages.yml, or debugging which release a
  tab is running.
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
| `.github/workflows/pages.yml` | Prod build env on release |

GitHub Pages base path: `/codeplug-studio/` (see `vite.config.ts`).

---

## Values

| Environment | `BUILD_ENV` | `BUILD_VERSION` |
| --- | --- | --- |
| local | `local` | `local` |
| prod (published release) | `prod` | SemVer from tag (leading `v` stripped) |

---

## Local smoke test

```bash
npm run dev          # footer: local · local
BUILD_ENV=prod BUILD_VERSION=v0.1.0 npm run build && npm run preview
```

---

## pages.yml

```yaml
env:
  BUILD_ENV: prod
  BUILD_VERSION: ${{ github.event.release.tag_name }}
```

After publishing a full release, verify footer on the live site shows `prod · <semver>`.
