---
name: progress-tracking
description: >-
  Maintains progress and outstanding markdown logs for multi-step codeplug-studio
  plans and features. Use when executing a Cursor plan, a multi-commit feature,
  or when the user asks to update progress/outstanding docs, hand off between
  agents, or before opening a PR for a larger initiative.
---

# Progress tracking (codeplug-studio)

Persistent **progress** and **outstanding** files preserve execution state when context is lost, agents switch, or work spans multiple PRs. Use for non-trivial scope (multi-commit, new feature area, or high coordination risk).

Skip for single-commit fixes with no plan.

---

## Two files — distinct roles

| File | Purpose | Put here | Do **not** put here |
|------|---------|----------|---------------------|
| **`*-progress.md`** | What **shipped** or is **in flight** | Merged PRs, branch names, verify steps, concrete file paths | Future plan steps not started; raw checklists copied from the plan |
| **`*-outstanding.md`** | **Debt discovered during execution** | Skipped scope, bugs found, follow-ups that block verification, doc drift | The plan's upcoming phases; backlog never in scope for this initiative |

**Outstanding is not a second plan.** Scheduled-but-not-started work stays in the Cursor plan or GitHub issue. Move an item to outstanding only when execution revealed it.

---

## Where files live

| Initiative | Progress | Outstanding |
|------------|----------|-------------|
| Epic / migration | `docs/poc-migration/<slug>-progress.md` | `docs/poc-migration/<slug>-outstanding.md` |
| Feature area | `docs/features/<topic>/<slug>-progress.md` | `docs/features/<topic>/<slug>-outstanding.md` |
| Phased delivery | `phase-N-progress.md` | `phase-N-outstanding.md` |

**Slug:** kebab-case from the plan or feature name (e.g. `epic-1`, `phase-0`, `library`).

Add a row to [docs/features/README.md](../../../docs/features/README.md) when creating a new topic folder under `docs/features/`.

---

## When to read and update

### At plan start (required for tracked initiatives)

1. Read linked **progress** and **outstanding** files if they exist.
2. If missing, create both from the templates below.
3. In the Cursor plan, add a **Progress tracking** section pointing at both files.

### During execution (at logical breakpoints)

Update **progress** when:

- A commit or PR lands a coherent slice (match [git-workflow](../git-workflow/SKILL.md) atomic commits).
- A slice flips to **Complete** with PR/issue links.
- Manual verify steps or file paths change.

Update **outstanding** when:

- You skip or narrow scope and need a follow-up later.
- You discover a bug, doc error, or CPS quirk during the work.
- Local verification is blocked on something outside the current PR.

**Cadence:**

| Plan size | Typical updates |
|-----------|-----------------|
| Small (1 PR, few files) | Once before opening PR |
| Medium (2–4 commits) | After each user-visible slice; before PR |
| Large / phased | Per phase + before each PR |

**Always update progress before opening a PR** for initiatives that use this skill.

### At handoff

Leave accurate **Status** lines, open PR URLs, branch names, and a **Next:** section for the successor agent.

---

## Progress file template

```markdown
# <Title> — progress

**Tracking:** [codeplug-studio#NNN](https://github.com/pskillen/codeplug-studio/issues/NNN)
**Plan:** `.cursor/plans/<plan-file>.plan.md` or GitHub issue
**Branch:** `12/author/slug` or `feat/slug`

---

## Overall status

**Status:** Not started | In progress | Complete (pending merge) | Complete

**Branch:** `12/author/slug`

---

## <Slice name>

**Status:** …
**PR:** …

**Delivered**

- …

**Verify**

- …

---

## Next

- …
```

Use checkboxes in **outstanding** only; progress uses **Status** + bullet lists.

---

## Outstanding file template

```markdown
# <Title> — outstanding

Items **skipped**, **incomplete**, or **discovered during execution** — not the plan's future phases.

**Tracking:** same as progress file

---

## <area>

- [ ] …
- [x] … (closed when fixed; brief note or PR link)

```

---

## Cursor plan integration

Plans that use progress tracking should include near the top:

```markdown
## Progress tracking

Read and update (per [progress-tracking](.cursor/skills/progress-tracking/SKILL.md)):

- **Progress:** [docs/poc-migration/.../<slug>-progress.md](path)
- **Outstanding:** [docs/poc-migration/.../<slug>-outstanding.md](path)

Update both at logical breakpoints and **before each PR**.
```

When a plan depends on another initiative, note **Prerequisite:** with link to the other progress file and required merge state.

---

## GitHub issues

- Link progress/outstanding paths in the tracking issue at kickoff.
- Do not duplicate the full progress log in the issue; markdown files are canonical for agent handoff.
- Close outstanding items by linking the fixing PR or opening a new issue if scope grew.

---

## Anti-patterns

- Copying the plan's full todo list into outstanding.
- Marking slices "done" in progress without PR/commit evidence.
- Creating phase files for a single small ticket.
- Letting progress go stale across PRs without a **Next** section.
