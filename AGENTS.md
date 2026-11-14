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
7. **Docs ship with behaviour** — tier-1 feature hubs, component sidecars, and index rows in the same PR as the code ([documentation-deliverables.mdc](.cursor/rules/documentation-deliverables.mdc), the `feature-docs` skill).
8. **New CPS format** — follow [adding-a-new-format.md](docs/features/import-export/adding-a-new-format.md) for adapter, trait, test, and UI checklist.
9. **New Web Serial radio adapter** — follow [adding-a-radio-adapter.md](docs/features/radio-read-write/adding-a-radio-adapter.md) (living checklist; update when implementation discovers cross-radio requirements). Write goes through FormatBuild + `assemble`; Read hydrates unmodelled/full-image state on the build.
10. **UI rework** — follow [docs/reference/styleguide/](docs/reference/styleguide/) for list shells, Sort… / reorder, and chrome conventions (interactive demos at `/styleguide`).
11. **Firmware flashing** — never vendor bytes in the repo (stock is user-supplied; tests are synthetic); hard interlocks are code; one guarded send path per updater. See [DESIGN.md — Firmware flashing](DESIGN.md#firmware-flashing).
12. **Danger zone** — rare jobs that change the radio itself run only from their own wizard; one guarded send path per tool, as narrow as the change; hard interlocks are code with a refusal test each; the AT-D890 range-change sender is the only code that writes LocalInfo. See [DESIGN.md — Danger zone](DESIGN.md#danger-zone).
13. **Channel identity** — wherever the UI identifies a channel, show its callsign and name together, callsign first (name alone only when there is no callsign); search and sort cover callsign too. See [channel-identity rule](.cursor/rules/channel-identity.mdc) and [styleguide — display](docs/reference/styleguide/display.md#channel-identity-callsign-and-name-together).

## Git workflow

Follow the `git-workflow` and `codeplug-conventions` skills from [`pskillen/agent-skills`](https://github.com/pskillen/agent-skills) (Claude Code: `core@pskillen` + `codeplug-studio@pskillen`; Cursor: `npx skills add pskillen/agent-skills`).

**GitHub operations use the `gh` CLI.** Issues, pull requests, comments, reviews, checks, merges, and releases are `gh` commands. A GitHub MCP tool that shows an interactive form (`create_pull_request`, `issue_write`, and any other call that asks the user to submit a card) is a failed operation: the form does not submit, and waiting for it does not create the issue or pull request. Do not call those tools. Do not wait on a form.

- Prefer **atomic conventional commits** per logical change.
- Branch + pull request for features; `main` holds releasable source.
- **Publish:** merge to `main` → continuous **next** deploy; push to `dev` → **dev** deploy; pre-release → **staging**; full GitHub release → **prod** on Cloudflare Pages (`https://codeplug.mm9pdy.net`).
- Do not commit `.env`, secrets, or personal `sample-exports/`.

### Batches of PRs: stack them, merge the stack once

CI takes 10–15 minutes a run, and `main` only merges a PR that is up to date with `main`, unless it merges as part of a GitHub stack. Side-by-side PRs from `main` cost a full extra CI run for every PR after the first.

- **Stack the PRs, not the work.** Builders still work in parallel, each in its own worktree from `main`.
- **Stack at open time, even when the PRs are unrelated.** Just before `gh pr create`, rebase onto the branch of the PR opened before it in the same batch (the top of the stack) and open with that branch as the base. The first PR of a batch opens on `main`. Whoever coordinates the batch tells each builder the current top branch. A later rebase inside the stack is fine.
- **Create the GitHub stack once every PR in the batch is open**, bottom to top. The API cannot add a PR to an existing stack; the owner can, in the GitHub UI, so ask them or wait until the batch is complete.
- **Merge the stack once**, from the top: that merges every open PR below it. Do not retarget children to `main` and merge them one by one.
- **Do not restack PRs already open from `main`** with CI done or running: it restarts their CI and gains nothing. Merge the green one, update the other.
- **Do not server-rebase the bottom of a stack on its own** (`gh pr update-branch --rebase`): the PR above stays on the old SHAs and goes DIRTY. Rebase the chain locally, `git rebase --onto <new lower head> <old lower head>` for each PR above, push each with `--force-with-lease`, then merge the stack.

```bash
# open a PR on top of the batch
git fetch origin && git rebase --onto origin/<top branch> $(git merge-base HEAD origin/main)
gh pr create --base <top branch> …

# once the batch is open, bottom to top
echo '{"pull_requests":[<bottom>,…,<top>]}' | gh api -X POST repos/pskillen/codeplug-studio/stacks --input -

# merge the whole stack
gh api -X PUT repos/pskillen/codeplug-studio/pulls/<top>/merge-async -f merge_method=merge -f sha=<top head sha>
```

## Plans and feature docs

All from [`pskillen/agent-skills`](https://github.com/pskillen/agent-skills):

- Plan from GitHub issues: `make-a-plan`. Epic-sized work: `multi-phase-plan`.
- Ship a ticket without a plan: `/drive-by-ticket` with `#N` + title.
- Feature documentation: `feature-docs`, plus the tiers and sidecars in `codeplug-conventions`.
- Multi-phase progress: `delivery-tracking` (`tmp/features/<name>/PROGRESS.md`). No progress or outstanding files in `docs/`; open gaps go under the hub's _Known gaps_ with their issue link.

## Disclaimer

Frequency and site data loaded from user CSVs is for amateur programming convenience. Not authoritative for emergency operations.
