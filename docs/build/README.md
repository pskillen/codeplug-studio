# Build and deploy

CI, GitHub Pages, and testing documentation for Codeplug Studio.

**Status:** Deferred to **Phase 1** (Vite scaffold). This folder is a placeholder until then.

## Planned contents

| Doc | Purpose |
| --- | --- |
| `README.md` (this file) | Index and deploy overview |
| `testing/README.md` | Vitest strategy, mapping test fixtures |
| `.github/workflows/pages.yml` | Build on release publish → GitHub Pages |

## Deploy intent

- **Trigger:** publish a full GitHub release (not pre-release) on `main`
- **Target:** GitHub Pages at `base: '/codeplug-studio/'` (HashRouter)
- **Reference:** [codeplug-tool pages.yml](https://github.com/pskillen/codeplug-tool/blob/main/.github/workflows/pages.yml) — adapt paths when scaffolding

See [DESIGN.md — Architecture](../../DESIGN.md#architecture) and [AGENTS.md](../../AGENTS.md).
