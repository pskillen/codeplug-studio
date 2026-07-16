---
name: make-a-plan
description: >-
  Create a Cursor execution plan for codeplug-studio from GitHub issue numbers.
  Pulls tickets, clarifies scope, structures work with commit checkpoints and
  documentation updates. Use when the user asks to make a plan, plan work for
  ticket(s), or start planning from issue numbers.
---

# Make a plan (codeplug-studio)

Turn one or more GitHub issues into a **Cursor plan** an agent can execute.

Repo: `pskillen/codeplug-studio` (`C:\Users\pskil\git\codeplug-studio`). Use **`user-github`** MCP for issues — not `gh`.

**Read first:** [DESIGN.md](../../../DESIGN.md), [docs/poc-migration/epic-1-context.md](../../../docs/poc-migration/epic-1-context.md).

---

## 1. Gather context

### Pull the ticket(s)

When the user gives issue number(s) (e.g. `#42`, `42 and 55`):

1. For each issue, call `issue_read` (`method: get`, `owner: pskillen`, `repo: codeplug-studio`).
2. Read comments (`method: get_comments`) when the body is thin or there is recent discussion.
3. Check sub-issues (`method: get_sub_issues`) when the issue is an epic or parent.

Summarise for yourself: problem, intended outcome, affected areas (`src/core/`, `src/app/`, `docs/`, …), linked docs, and open questions.

### Explore the codebase

Read relevant source and docs before drafting the plan. Prefer existing patterns over inventing new ones.

Check for existing execution logs:

- `docs/poc-migration/*-progress.md` and `*-outstanding.md` (epic / migration work)
- `docs/features/<topic>/*-progress.md` and `*-outstanding.md`
- Feature READMEs under `docs/features/<topic>/`
- Reference data under `docs/reference/`

### Clarify before planning

Use **AskQuestion** (or ask conversationally) when anything material is ambiguous:

- Scope boundaries (in vs out)
- Which layer owns the change (core vs app vs integrations)
- Whether behaviour is new or a fix to existing behaviour
- Dependencies on other open issues or branches
- Whether progress/outstanding files already exist or need creating

Do **not** produce a detailed plan until blockers are resolved or explicitly deferred with a note.

**If not running in plan mode** stop and ask for confirmation. If user insists we can continue to make a plan, but otherwise ask them to enable plan mode.

### Vendor-specific features and limits

Follow [Vendor boundaries](../../../AGENTS.md#vendor-boundaries) in [`AGENTS.md`](../../../AGENTS.md) for all work — not only when planning.

**When drafting a plan** for library CRUD, build UI, or model slices, include a short **vendor-neutral internal model** note in Context:

- What stays unlimited / radio-agnostic in mutations and library UI
- What the exporter may truncate or warn on (defer to export slice)
- **Build capability traits** — organisation semantics on builds, not format shapes in the library
- UUID `id` FK rules — `name` is a label, not a relationship key

If a plan inherits pre-existing vendor leakage, note it in **Out of scope** or **Outstanding** rather than copying the pattern into new code.

**Do not** plan round-trip fidelity gates or wire stash for export. Test import and export mappings independently per [DESIGN.md — Testing](../../../DESIGN.md#testing).

---

## 2. Plan structure

Use this template. Adapt sections to scope; omit what does not apply.

```markdown
# <Title> — plan

**Tracking:** [codeplug-studio#NNN](https://github.com/pskillen/codeplug-studio/issues/NNN)
**Branch:** `{num}/{author}/{short-slug}` (from [git-workflow](.cursor/skills/git-workflow/SKILL.md))

---

## Goal

<One paragraph: what done looks like for the operator/contributor.>

## Context

<Brief summary from issue(s) + codebase exploration. Link DESIGN.md / epic-1-context when relevant. Note vendor-neutral boundaries per AGENTS.md.>

## Progress tracking

<Only when multi-plan / multi-agent / multi-day / multi-PR handoff is likely — see section 3. Otherwise omit or note N/A.>

## Approach

<Ordered phases or slices. Each slice = one logical unit of work.>

### Slice 1: <name>

- …
- **Commit checkpoint:** <when this slice is complete, commit before starting the next slice>

### Slice 2: <name>

- …
- **Commit checkpoint:** …

## Git workflow

<Required section — see section 4 below.>

## Documentation

<Required section — see section 5 below.>

## Test plan

- [ ] `npm run lint && npm run test` (when package.json exists)
- [ ] `npm run format:check` (or `npm run format` then commit any fixes)
- [ ] `npm run build` (when touching build/config/types)
- [ ] `npm run dev` — exercise affected route(s)
- [ ] Per-direction mapping tests for import/export work (see DESIGN.md)
- [ ] …

## Out of scope

<Explicit deferrals to avoid scope creep.>
```

**Do not** include a pre-written list of commit messages or a commit log in the plan. Use **commit checkpoints** at the end of each slice instead.

---

## 3. Progress tracking (when to include)

Progress/outstanding files exist to carry context across **multi-plan**, **multi-agent**, **multi-day**, or **multi-PR** work. Follow [progress-tracking](.cursor/skills/progress-tracking/SKILL.md).

| Include Progress tracking section + create files | Skip |
|--------------------------------------------------|------|
| Epic, migration, new feature area | Small single-phase plan (one PR, one session) |
| Likely multi-plan / multi-agent / multi-day handoff | Drive-by-sized scope that finishes in one sitting |
| Multi-PR or high coordination risk | Few-file fix with no future continuation expected |

**Default for small plans: skip.** Do not create empty progress/outstanding pairs. If scope grows mid-execution, start the pair then.

When required, include:

```markdown
## Progress tracking

Read and update (per [progress-tracking](.cursor/skills/progress-tracking/SKILL.md)):

- **Progress:** [docs/poc-migration/<slug>-progress.md](path) or [docs/features/<topic>/<slug>-progress.md](path)
- **Outstanding:** [docs/poc-migration/<slug>-outstanding.md](path) or [docs/features/<topic>/<slug>-outstanding.md](path)

Create both at plan kickoff if missing. Update at each commit checkpoint and before opening a PR.
```

When skipped, omit the section entirely (or note `Progress tracking: N/A — small single-phase`).

## 4. Git workflow — mandatory plan section

Every plan **must** include a **Git workflow** section. Pull rules from [git-workflow](.cursor/skills/git-workflow/SKILL.md) and **insist on commit-as-you-go**.

Include this block (adapt branch name and checkpoints to the plan):

```markdown
## Git workflow

Follow [git-workflow](.cursor/skills/git-workflow/SKILL.md).

**Branch:** create `{num}/{author}/{short-slug}` from `origin/main` before the first code change.

### Commit as you go — non-negotiable

The executing agent **must commit at every commit checkpoint** in this plan **before moving to the next slice**. Do **not** batch all changes into one commit at the end. Do **not** defer commits until the PR.

At each checkpoint:

1. Run relevant pre-commit checks when `package.json` exists.
2. Stage only files for the completed slice.
3. Create an **atomic conventional commit** (`feat`, `fix`, `docs`, etc.).
4. Update progress/outstanding docs if this initiative uses them.
5. Only then start the next slice.

If a checkpoint spans docs + code, prefer **two commits** (docs, then code) when they are logically separable.

**Shell:** set `working_directory` to `C:\Users\pskil\git\codeplug-studio` for all git commands.

**PR:** one PR in `pskillen/codeplug-studio` via `user-github` MCP; link issue with `Closes #N`.

### Before opening the PR

1. When toolchain exists: run `npm run format` — CI fails on `format:check` if Prettier drift remains.
2. If format changed files, commit them (`chore: format` or include in the last slice commit).
3. When toolchain exists: run `npm run format:check && npm run lint && npm run test && npm run build`.
4. Push the branch, then open the PR.
```

This section **overrides** the default "commit only when the user asks" rule — plans that include it require commits at checkpoints without waiting for the user to prompt.

---

## 5. Documentation — mandatory plan section

Every plan **must** call out documentation work. Execution must satisfy [documentation-deliverables.mdc](../rules/documentation-deliverables.mdc) at each commit checkpoint — docs are not deferred to PR time.

Use the right skill:

| Situation | Skill / action |
|-----------|----------------|
| New or changed feature behaviour | [feature-docs](.cursor/skills/feature-docs/SKILL.md) — update hub README, deep dives, `docs/features/README.md` index |
| Multi-plan / multi-agent / multi-day / multi-PR (handoff likely) | [progress-tracking](.cursor/skills/progress-tracking/SKILL.md) — progress + outstanding pair |
| Small single-phase ticket | No progress files — feature docs / sidecars still apply when behaviour changes |
| New shared component under `src/app/` | Add a **sidecar markdown** `<ComponentName>.md` in the same directory |

### Component sidecar pattern

When the plan introduces a new reusable component (e.g. `src/app/components/MyWidget/MyWidget.tsx`), add a slice:

- Create `MyWidget.md` alongside the component.
- Cover: **Purpose**, **Props** (table), **Usage** (short TSX example), **Behaviour**, **Related** links.

Sidecars are for contributors and agents; feature docs under `docs/features/` remain the canonical product documentation.

### Documentation slice example

```markdown
### Slice N: Document <topic>

- Update `docs/features/<topic>/README.md` implementation status
- Add/update deep dive if behaviour is non-obvious
- **Commit checkpoint:** docs-only commit before or after the code slice it describes
```

---

## 6. Sizing and phasing

| Scope | Slices | Progress files | PRs |
|-------|--------|----------------|-----|
| Single-file / small single-phase | 1–3 | **Skip** | 1 |
| Small feature, one session, one PR | 2–3 with checkpoints | **Skip** unless handoff risk appears | 1 |
| New feature area / migration / multi-day | Phases with checkpoint per phase | **Required** | 1 per phase or one if small |

Each slice should be **completable and committable in one session**. If a slice feels too large, split it and add a checkpoint between sub-slices.

---

## 7. After the plan

1. **Link the plan** from the tracking issue (comment via `add_issue_comment` if the plan lives in `.cursor/plans/` or paste a summary).
2. Confirm branch name and first slice with the user if scope was uncertain.
3. When execution starts, the agent loads this plan **and** [git-workflow](.cursor/skills/git-workflow/SKILL.md); commits happen at checkpoints without further prompting.

---

## Anti-patterns

- Planning from issue title alone without reading the issue body and code.
- A "Commits" section listing predicted commit messages — use **commit checkpoints** instead.
- "Commit everything at the end before PR."
- Copying the full plan todo list into `*-outstanding.md`.
- Skipping component sidecars for new shared components.
- Creating progress files for a one-line fix or small single-phase plan.
- Baking radio profile caps into library mutations, validation, or CRUD UI.
- Planning round-trip system tests as the primary quality gate.
- Planning `OPENGD77_MAX_*` constants for library/core work without an explicit export-only slice.
- Creating a plan in the local repo unless specifically asked. Use the common Cursor plans directory. If you're trying to create one in the local dir it's likely you're not running in plan mode, so stop and ask the user to switch to plan mode.
- Creating a `something.md` file — you should be making `something.plan.md` — again this is a symptom of not running in plan mode.
