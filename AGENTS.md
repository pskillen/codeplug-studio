# Agent guide — Codeplug Studio

Instructions for AI agents working in this repository.

## What this repo is

**Codeplug Studio** is a browser-based designer for amateur radio codeplug layouts. Operators curate a **library** of channels, talk groups, and contacts, assemble **format-specific builds** per radio workflow, and export CPS-ready files (and, where implemented, write radios over Web Serial). It does **not** replace vendor CPS as the only programming path — see [DESIGN.md](DESIGN.md).

**Read first:** [DESIGN.md](DESIGN.md) (product constitution). **Active issue hub:** [Milestone 2: post-MVP (#495)](https://github.com/pskillen/codeplug-studio/issues/495). Migration background (Milestone 1 archive): [docs/poc-migration/epic-1-context.md](docs/poc-migration/epic-1-context.md) and closed [Epic #1](https://github.com/pskillen/codeplug-studio/issues/1).

Application code lives under `src/core/`, `src/integrations/`, and `src/app/` with path aliases `@core/*`, `@integrations/*`, `@app/*`.

## Repository layout

| Path                         | Role                                                                                                                                                                   |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md`                  | User-facing overview                                                                                                                                                   |
| `DESIGN.md`                  | Living product and architecture constitution                                                                                                                           |
| `AGENTS.md`                  | This file — agent workflow index                                                                                                                                       |
| `docs/poc-migration/`        | Epic 1 migration context, progress logs                                                                                                                                |
| `docs/features/`             | Tier 1 — library, builds, traits, product behaviour                                                                                                                    |
| `docs/reference/`            | Tier 2 (domain root) + [export-formats/](docs/reference/export-formats/), [radios/](docs/reference/radios/), [remote-directories/](docs/reference/remote-directories/) |
| `docs/reference/styleguide/` | UI interaction conventions (list kit, Sort…, chrome) — [styleguide](docs/reference/styleguide/)                                                                        |
| `docs/build/`                | CI, Pages, [testing](docs/build/testing/README.md)                                                                                                                     |
| `src/core/`                  | Models, domain, import/export, services — **no React**                                                                                                                 |
| `src/integrations/`          | Browser I/O: persistence, cloud, repeater APIs                                                                                                                         |
| `src/app/`                   | React routes, features, components, thin state                                                                                                                         |
| `.cursor/rules/`             | File-scoped editor rules (+ always-applied deliverables)                                                                                                               |
| `.cursor/skills/`            | Agent skills — git workflow, plans, docs, progress                                                                                                                     |

**Dependency rule:** `app` → `core`; `integrations` → `core`. Never `core` → `app`.

## Vendor boundaries

The **library** and domain layer are **vendor-neutral**. Radio caps, column names, wire strings, and profile limits apply only at import/export and in `docs/reference/export-formats/<format>/` / `docs/reference/radios/<manufacturer>/<model>/`.

| Layer                                       | Apply vendor limits?                | Examples                                                                                                                                                                          |
| ------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Import / export boundary**                | **Yes**                             | Column mapping, cardinality caps, truncation, warnings — `src/core/import-export/formats/`, `docs/reference/`                                                                     |
| **Library, mutations, validation, CRUD UI** | **No**                              | `src/core/` models and domain — no `OPENGD77_MAX_*`, no format-specific cardinality in library CRUD                                                                               |
| **Format builds**                           | **Trait-shaped, not format-shaped** | Organisation semantics (zones, scan lists, flat memories) compose from **build capability traits** — see [DESIGN.md — Build capability traits](DESIGN.md#build-capability-traits) |

**Internal FK rules:** UUID `id` foreign keys for relationships. `name` fields are display/export labels, not relationship keys.

**Formats are siblings:** OpenGD77 CSV, DM32 CSV, CHIRP CSV, native YAML — OpenGD77 is not the internal model. **Variants** (1701, UV-5R, …) are profiles within a format.

**Export source of truth:** typed model fields (+ explicit boundary rules). Do not stash raw CPS cells in metadata and replay on export. See [`.cursor/rules/export-from-model.mdc`](.cursor/rules/export-from-model.mdc).

**Radio limits SoT:** hardware cardinality, RF band bounds, and name-length ceilings → `src/core/radios/<mfr>/<model>/limits.ts` (code) + `docs/reference/radios/<mfr>/<model>/limits.md` (human). Format and radio-io profiles **import** from that module; do not re-declare literals. Protocol-only layout sizes may stay in `integrations/radio-io/`, but cardinality must re-export from core. No radio-specific numeric fallbacks in `src/app/`. See [vendor-boundaries.mdc](.cursor/rules/vendor-boundaries.mdc).

## Working principles

1. **Import-first** — invest in thorough CPS → internal mapping; test with per-direction fixtures.
2. **Export as projection** — library + build → CPS files; re-import may differ; document loss.
3. **Library, then builds** — one master inventory; per-format builds with trait-shaped workflows.
4. **Parse by header name** — CPS CSV column order varies; never hard-code column positions.
5. **Minimize scope** — one feature per PR; match existing patterns once scaffold exists.
6. **Privacy** — operator data and tokens stay in browser storage only; never in the repo.
7. **Docs ship with behaviour** — tier-1 feature hubs, component sidecars, and index rows in the same PR as the code ([documentation-deliverables.mdc](.cursor/rules/documentation-deliverables.mdc), [feature-docs](.cursor/skills/feature-docs/SKILL.md)).
8. **New CPS format** — follow [adding-a-new-format.md](docs/features/import-export/adding-a-new-format.md) for adapter, trait, test, and UI checklist.
9. **New Web Serial radio adapter** — follow [adding-a-radio-adapter.md](docs/features/radio-read-write/adding-a-radio-adapter.md) (living checklist; update when implementation discovers cross-radio requirements). Write goes through FormatBuild + `assemble`; Read hydrates unmodelled/full-image state on the build.
10. **UI rework** — follow [docs/reference/styleguide/](docs/reference/styleguide/) for list shells, Sort… / reorder, and chrome conventions (interactive demos at `/styleguide`).
11. **Firmware flashing** — never vendor bytes in the repo (stock is user-supplied; tests are synthetic); hard interlocks are code; one guarded send path per updater. See [DESIGN.md — Firmware flashing](DESIGN.md#firmware-flashing).

## Git workflow

Follow [`.cursor/skills/git-workflow/SKILL.md`](.cursor/skills/git-workflow/SKILL.md).

**GitHub operations use the `gh` CLI.** Issues, pull requests, comments, reviews, checks, merges, and releases are `gh` commands. A GitHub MCP tool that shows an interactive form (`create_pull_request`, `issue_write`, and any other call that asks the user to submit a card) is a failed operation: the form does not submit, and waiting for it does not create the issue or pull request. Do not call those tools. Do not wait on a form.

- Prefer **atomic conventional commits** per logical change.
- Branch + pull request for features; `main` holds releasable source.
- **Publish:** merge to `main` → continuous **next** deploy; push to `dev` → **dev** deploy; pre-release → **staging**; full GitHub release → **prod** on Cloudflare Pages (`https://codeplug.mm9pdy.net`).
- Do not commit `.env`, secrets, or personal `sample-exports/`.

## Plans and feature docs

- Plan from GitHub issues: [make-a-plan](.cursor/skills/make-a-plan/SKILL.md).
- Ship a ticket without a plan: paste `#N` + title and `@drive-by-ticket` — [drive-by-ticket](.cursor/skills/drive-by-ticket/SKILL.md).
- Feature documentation: [feature-docs](.cursor/skills/feature-docs/SKILL.md).
- Multi-commit work: [progress-tracking](.cursor/skills/progress-tracking/SKILL.md) under `docs/poc-migration/` or `docs/features/`.

## Disclaimer

Frequency and site data loaded from user CSVs is for amateur programming convenience. Not authoritative for emergency operations.

<!-- BEGIN house-rules: synced from pskillen/firmware-mods workspace/house-rules.md; do not edit here -->

## House rules (all radio repos)

Shared by every repo under `~/git/radios/`. Source: `pskillen/firmware-mods`, `workspace/house-rules.md`; copied into
each repo's `AGENTS.md` by its `sync-house-rules.py` script. Edit it there, not here. This repo's own rules, above or below
this section, win on anything about this repo.

**The repos.** `firmware-mods` (shared spec, ways of working, the `radios` Claude plugin), `anytone-d890-firmware`,
`baofeng-dm32-firmware`, `codeplug-studio`, and `mm9pdy-firmware` (public: releases and user manuals). How we work:
[firmware-mods/ways-of-working](https://github.com/pskillen/firmware-mods/blob/main/ways-of-working/README.md).

**Talking to the owner.** The owner often reads on a phone.

- First line: what you need from them, or "nothing". At most 15 lines; detail goes in a file.
- Questions numbered, each with your recommendation, so "1 yes, 2 b" is a full answer.
- Send any file they must read; don't just name a path. Links as full URLs.
- Never use a tool that shows a card to click or fill in (question pickers, plan approval, MCP forms). Ask in text.

**Git.**

- Never commit to `main`. Work on a branch; one PR per delivery per repo.
- Long deliveries go as a **linear stack** of PRs: each PR's base is the one below; every PR body starts with the
  stack line and merge order.
- **Rebase, never merge, into feature branches.** When the base moves, rebase onto it (`git rebase --onto` up a
  stack) and push with `--force-with-lease`. Tell any session whose branch sits on yours first. No "Update branch"
  button, no merging `main` in.
- **Into `main`: a merge commit,** the only place merge commits belong. Squash only when a branch's history isn't
  worth keeping. The owner merges unless they've said otherwise.
- **No attribution lines** (`Co-Authored-By`, "Generated with ...") in commits or PR bodies.
- GitHub through the `gh` CLI. `gh issue view` off a TTY drops the body: use `--json title,body,comments`.

**Scratch work** lives in the repo's gitignored `tmp/`: `tmp/investigations/<topic>/`, `tmp/features/<topic>/`, and
`tmp/agents/` (who is working here). Worktrees symlink the main checkout's `tmp/`. Notes become durable docs once
delivery starts. Never link to `tmp/` from anything committed.

**User-facing changes ship their public docs in the same PR:** manual pages, screenshots from the demo codeplug,
release-notes line, feature-list rows. Public docs: no internals, no private links, no owner data.

**Never** flash a radio or open its serial port (the owner does that, from a PR's CI artifact via Codeplug Studio),
and never commit vendor firmware.

**Claude Code:** install the `radios` plugin for the role agents and skills:
`claude plugin marketplace add pskillen/firmware-mods`, then `claude plugin install radios@mm9pdy`.

<!-- END house-rules -->
