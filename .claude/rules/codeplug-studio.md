---
paths:
  - "**/*.{ts,tsx,md}"
---

# Codeplug Studio edits

Read [`AGENTS.md`](../../AGENTS.md) and [`DESIGN.md`](../../DESIGN.md) first. For git, plans, and docs see [`.claude/skills/`](../skills/).

**Critical rules:** [documentation-deliverables.md](documentation-deliverables.md), [vendor-boundaries.md](vendor-boundaries.md), [layer-boundaries.md](layer-boundaries.md), [library-and-builds.md](library-and-builds.md), [export-from-model.md](export-from-model.md), and [format-agnostic-docs.md](format-agnostic-docs.md). When editing related files, if you notice violations — even outside your current task — **flag them to the user as a high concern** before or alongside your main work. Do not silently ignore, copy the pattern, or defer without mention. Do not attempt to fix if it's outside the original instruction.

## Product shape

- **Library** — master inventory of RF assets (channels, talk groups, contacts, …).
- **Format builds** — per-target assembly with trait-shaped layout; export is a **projection**, not round-trip fidelity.
- **Application services** — routes call `importIntoLibrary`, `exportBuild`, `assemble(build, library)`; not format adapters directly.

## SPA (`src/` when scaffold exists)

- React + TypeScript under `src/app/`; Vite bundles for Cloudflare Pages (`base: '/'`).
- Routing via `react-router` `createBrowserRouter` (path URLs).
- Build info via Vite `define` — see `version-number` skill when added in Phase 1.

## Scope

- Cloudflare Pages deploy via GitHub Actions — see `docs/build/README.md`.
- Do not add committed sample codeplugs; use gitignored `sample-exports/` for local CPS files.
- Migration background: [docs/poc-migration/epic-1-context.md](../../docs/poc-migration/epic-1-context.md).
