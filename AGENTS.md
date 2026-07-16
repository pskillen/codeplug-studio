# Agent guide — Codeplug Studio

Instructions for AI agents working in this repository.

## What this repo is

**Codeplug Studio** is a browser-based designer for amateur radio codeplug layouts. Operators curate a **library** of channels, talk groups, and contacts, assemble **format-specific builds** per radio workflow, and export CPS-ready files for vendor CPS to flash. It does **not** write binary codeplugs or replace vendor CPS.

**Read first:** [DESIGN.md](DESIGN.md) (product constitution) and [docs/poc-migration/epic-1-context.md](docs/poc-migration/epic-1-context.md) (migration background from [codeplug-tool](https://github.com/pskillen/codeplug-tool)).

Application code lives under `src/core/`, `src/integrations/`, and `src/app/` with path aliases `@core/*`, `@integrations/*`, `@app/*`.

## Repository layout

| Path                  | Role                                                     |
| --------------------- | -------------------------------------------------------- |
| `README.md`           | User-facing overview                                     |
| `DESIGN.md`           | Living product and architecture constitution             |
| `AGENTS.md`           | This file — agent workflow index                         |
| `docs/poc-migration/` | Epic 1 migration context, progress logs                  |
| `docs/features/`      | Tier 1 — library, builds, traits, product behaviour      |
| `docs/reference/`     | Tier 2 (domain) + Tier 3 (per-format wire tables)        |
| `docs/build/`         | CI, Pages, [testing](docs/build/testing/README.md)       |
| `src/core/`           | Models, domain, import/export, services — **no React**   |
| `src/integrations/`   | Browser I/O: persistence, cloud, repeater APIs           |
| `src/app/`            | React routes, features, components, thin state           |
| `.cursor/rules/`      | File-scoped editor rules (+ always-applied deliverables) |
| `.cursor/skills/`     | Agent skills — git workflow, plans, docs, progress       |

**Dependency rule:** `app` → `core`; `integrations` → `core`. Never `core` → `app`.

## Vendor boundaries

The **library** and domain layer are **vendor-neutral**. Radio caps, column names, wire strings, and profile limits apply only at import/export and in `docs/reference/<format>/`.

| Layer                                       | Apply vendor limits?                | Examples                                                                                                                                                                          |
| ------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Import / export boundary**                | **Yes**                             | Column mapping, cardinality caps, truncation, warnings — `src/core/import-export/formats/`, `docs/reference/`                                                                     |
| **Library, mutations, validation, CRUD UI** | **No**                              | `src/core/` models and domain — no `OPENGD77_MAX_*`, no format-specific cardinality in library CRUD                                                                               |
| **Format builds**                           | **Trait-shaped, not format-shaped** | Organisation semantics (zones, scan lists, flat memories) compose from **build capability traits** — see [DESIGN.md — Build capability traits](DESIGN.md#build-capability-traits) |

**Internal FK rules:** UUID `id` foreign keys for relationships. `name` fields are display/export labels, not relationship keys.

**Formats are siblings:** OpenGD77 CSV, DM32 CSV, CHIRP CSV, native YAML — OpenGD77 is not the internal model. **Variants** (1701, UV-5R, …) are profiles within a format.

**Export source of truth:** typed model fields (+ explicit boundary rules). Do not stash raw CPS cells in metadata and replay on export. See [`.cursor/rules/export-from-model.mdc`](.cursor/rules/export-from-model.mdc).

## Working principles

1. **Import-first** — invest in thorough CPS → internal mapping; test with per-direction fixtures.
2. **Export as projection** — library + build → CPS files; re-import may differ; document loss.
3. **Library, then builds** — one master inventory; per-format builds with trait-shaped workflows.
4. **Parse by header name** — CPS CSV column order varies; never hard-code column positions.
5. **Minimize scope** — one feature per PR; match existing patterns once scaffold exists.
6. **Privacy** — operator data and tokens stay in browser storage only; never in the repo.
7. **Docs ship with behaviour** — tier-1 feature hubs, component sidecars, and index rows in the same PR as the code ([documentation-deliverables.mdc](.cursor/rules/documentation-deliverables.mdc), [feature-docs](.cursor/skills/feature-docs/SKILL.md)).
8. **New CPS format** — follow [adding-a-new-format.md](docs/features/import-export/adding-a-new-format.md) for adapter, trait, test, and UI checklist.

## Git workflow

Follow [`.cursor/skills/git-workflow/SKILL.md`](.cursor/skills/git-workflow/SKILL.md).

- Prefer **atomic conventional commits** per logical change.
- Branch + pull request for features; `main` holds releasable source.
- **Publish:** merge to `main` → continuous **next** deploy; push to `dev` → **dev** deploy; pre-release → **staging**; full GitHub release → **prod** on Cloudflare Pages (`https://codeplug.mm9pdy.net`).
- Use **`user-github`** MCP for issues and PRs — not `gh` CLI.
- Do not commit `.env`, secrets, or personal `sample-exports/`.

## Plans and feature docs

- Plan from GitHub issues: [make-a-plan](.cursor/skills/make-a-plan/SKILL.md).
- Ship a ticket without a plan: paste `#N` + title and `@drive-by-ticket` — [drive-by-ticket](.cursor/skills/drive-by-ticket/SKILL.md).
- Feature documentation: [feature-docs](.cursor/skills/feature-docs/SKILL.md).
- Multi-commit work: [progress-tracking](.cursor/skills/progress-tracking/SKILL.md) under `docs/poc-migration/` or `docs/features/`.

## Disclaimer

Frequency and site data loaded from user CSVs is for amateur programming convenience. Not authoritative for emergency operations.
