---
name: drive-by-ticket
description: >-
  Execute a GitHub issue end-to-end in codeplug-studio without writing a Cursor
  plan: branch, implement in atomic commits, document, open PR, and babysit CI
  until green. Use when the user pastes an issue number/title with @drive-by-ticket,
  or asks to ship a ticket directly.
disable-model-invocation: true
---

# Drive-by ticket (codeplug-studio)

Ship a GitHub issue as a **merge-ready PR with green CI** — no Cursor plan file, no plan mode.

**Invocation:** paste issue number + title, then `@drive-by-ticket` and submit.

```text
#42 Add zone grouping to build UI
@drive-by-ticket
```

Repo: `pskillen/codeplug-studio`. Use **`user-github`** MCP for issues and PRs — not `gh`.

**Read first:** [DESIGN.md](../../../DESIGN.md), [AGENTS.md](../../../AGENTS.md#vendor-boundaries).

**Sibling skills:** [git-workflow](../git-workflow/SKILL.md), [feature-docs](../feature-docs/SKILL.md), [progress-tracking](../progress-tracking/SKILL.md). For planning only, use [make-a-plan](../make-a-plan/SKILL.md).

---

## What this skill does vs make-a-plan

| Step | make-a-plan | drive-by-ticket |
|------|-------------|-----------------|
| Pull issue + explore code | Yes | Yes |
| Write `.cursor/plans/*.plan.md` | Yes | **No** |
| Require plan mode | Yes | **No** |
| Branch + atomic commits | At execution | Yes |
| Docs + progress files | At execution | Feature docs always when needed; progress only if handoff likely |
| Open PR | At execution | Yes |
| Babysit CI to green | Implicit | **Required exit criterion** |

Work breakdown stays **in conversation** (TodoWrite or a short mental slice list). Do not create plan files.

---

## Exit criterion

Done when **all** are true:

1. Branch pushed; PR open in `pskillen/codeplug-studio` with `Closes #N`.
2. Local gate passed: `npm run format:check && npm run lint && npm run test && npm run build` (when `package.json` exists).
3. PR CI **green** — all required check runs succeeded (`pull_request_read` `method: get_check_runs`).
4. No unresolved review threads that require code changes (Bugbot or human).
5. Documentation deliverables satisfied per [documentation-deliverables.mdc](../rules/documentation-deliverables.mdc).

Return the **PR URL** to the user when finished.

---

## 1. Gather context

Parse issue number from the user message (`#42`, `42`, `codeplug-studio#42`).

1. `issue_read` (`method: get`, `owner: pskillen`, `repo: codeplug-studio`).
2. `issue_read` (`method: get_comments`) when the body is thin or discussion is recent.
3. `issue_read` (`method: get_sub_issues`) for epics/parents — if children exist, **stop** and ask whether to ship the parent, one child, or switch to [make-a-plan](../make-a-plan/SKILL.md).

Summarise: problem, intended outcome, affected layers (`src/core/`, `src/app/`, `docs/`), linked docs, open questions.

Explore the codebase before coding. Prefer existing patterns.

Check existing execution logs **when present** (do not create new ones for small tickets):

- `docs/poc-migration/*-progress.md` / `*-outstanding.md`
- `docs/features/<topic>/*-progress.md` / `*-outstanding.md`
- Feature READMEs under `docs/features/<topic>/`

### Clarify blockers only

Use **AskQuestion** when material ambiguity would cause wrong-layer work or scope creep. Do **not** block on writing a plan — resolve or explicitly defer in PR **Out of scope**.

### Vendor boundaries

Follow [AGENTS.md — Vendor boundaries](../../../AGENTS.md#vendor-boundaries):

- Library CRUD / mutations: vendor-neutral; no `OPENGD77_MAX_*` in core or app.
- UUID `id` FKs; `name` is a label, not a relationship key.
- Build organisation via **capability traits**, not format-shaped library zones.
- No wire stash on export; no round-trip fidelity as the primary test gate.

Flag pre-existing vendor leakage — do not copy into new code.

---

## 2. Branch and slice the work

`get_me` for GitHub login → branch author segment.

**Branch:** `{num}/{author}/{short-slug}` from `origin/main` via `create_branch` or local git.

**Shell:** set `working_directory` to the codeplug-studio repo root for all git commands. Use `required_permissions: ["git_write"]`; add `"network"` for fetch/push.

### Internal slices (no plan file)

Break work into **2–5 committable slices** in a TodoWrite list or short bullet list. Each slice ends with a **commit checkpoint** before the next slice starts.

| Scope | Slices | Progress files |
|-------|--------|----------------|
| Single-file / small single-phase | 1–3 | **Skip** |
| Small feature, one session, one PR | 2–3 | **Skip** unless handoff risk appears |
| Epic / multi-day / multi-agent / multi-PR | Prefer [make-a-plan](../make-a-plan/SKILL.md); if continuing here | **Required** — [progress-tracking](../progress-tracking/SKILL.md) |

Progress/outstanding files carry context across multi-plan / multi-agent / multi-day work. Most `@drive-by-ticket` runs are small and single-phase — **do not create them**. If the ticket grows mid-flight, start the pair then.

Example slice list (in chat, not a file):

```text
- [ ] Slice 1: core mutation + tests → commit
- [ ] Slice 2: app UI wiring → commit
- [ ] Slice 3: feature docs + sidecar → commit
```

---

## 3. Execute — commit as you go (non-negotiable)

This skill **overrides** "commit only when the user asks". Commit at **every slice checkpoint** without waiting for the user.

At each checkpoint:

1. Run slice-relevant checks (`npm run lint`, `npm run test`, …).
2. Stage only files for the completed slice.
3. Create an **atomic conventional commit** (`feat`, `fix`, `docs`, …) per [git-workflow](../git-workflow/SKILL.md).
4. Update progress/outstanding docs **only when this initiative already uses them** (or just created them for handoff risk).
5. `git status -sb` — working tree clean before the next slice.

**Forbidden:** batching many edits then one commit at PR time.

If a slice spans docs + code, prefer **two commits** when logically separable.

After any long pause or handoff summary: `git log -5` and `git status -sb` — do not assume prior commits landed.

---

## 4. Documentation

Satisfy [documentation-deliverables.mdc](../rules/documentation-deliverables.mdc) **in the same PR** as behaviour — not deferred.

| Situation | Action |
|-----------|--------|
| New or changed feature behaviour | [feature-docs](../feature-docs/SKILL.md) — hub README, deep dives, `docs/features/README.md` index |
| Multi-plan / multi-agent / multi-day / multi-PR (handoff likely) | [progress-tracking](../progress-tracking/SKILL.md) — progress + outstanding pair |
| Small single-phase ticket | No progress files |
| New reusable component under `src/app/components/` | Sidecar `<ComponentName>.md` next to the component |

Docs are their own slice with their own commit checkpoint when non-trivial.

---

## 5. Pre-PR local gate

Before push:

1. `npm run format` — commit Prettier fixes (`chore: format` or fold into last slice).
2. `npm run format:check && npm run lint && npm run test && npm run build`.
3. `npm run dev` — smoke affected route(s) when behaviour changed.
4. Import/export work: per-direction mapping tests per [DESIGN.md — Testing](../../../DESIGN.md#testing).
5. Confirm no secrets or personal CPS files staged.
6. If this initiative uses progress files, update them with branch name and verify steps.

---

## 6. Open PR

1. Push branch (`git push -u origin HEAD`, `network` permission).
2. `create_pull_request` in `pskillen/codeplug-studio`.
3. Body — use [git-workflow PR template](../git-workflow/SKILL.md#6-pull-requests); include `Closes #N`.
4. `add_issue_comment` on the issue with PR link (optional but helpful).

---

## 7. Babysit until green

Do not hand off after opening the PR. Loop until the exit criterion is met.

1. **CI:** `pull_request_read` (`method: get_check_runs`, `method: get_status`). If failing:
   - Reproduce locally when possible.
   - Fix within PR scope; push; re-check.
   - If branch may be behind `main`, `update_pull_request_branch` then re-check.
   - Never weaken CI config just to pass.
   - For opaque CI failures, use **ci-investigator** subagent on the failing check.
2. **Comments:** `get_review_comments` — filter unresolved threads. Fix valid Bugbot/human findings; reply when disagreeing.
3. **Conflicts:** resolve intelligently; if intent conflicts with `main`, ask the user.

Push scoped fixes and re-watch until **mergeable + green + comments triaged**.

---

## Anti-patterns

- Creating a `.cursor/plans/` file — use [make-a-plan](../make-a-plan/SKILL.md) instead.
- Creating progress/outstanding files for a small single-phase ticket.
- Skipping progress files when multi-plan / multi-agent / multi-day continuation is likely.
- Executing from issue title alone without `issue_read` and code exploration.
- One giant commit before PR.
- Deferring tier-1 docs to a follow-up PR for the same behaviour.
- Stopping after PR open with red CI.
- Baking radio profile caps into library mutations or CRUD UI.
- Using `gh` CLI (not available).

---

## Quick reference

```text
User: #N Title + @drive-by-ticket
  → issue_read + explore
  → branch {N}/{author}/{slug}
  → slices with atomic commits
  → docs in same PR
  → local format:check + lint + test + build
  → push + create_pull_request (Closes #N)
  → babysit CI + comments until green
  → return PR URL
```
