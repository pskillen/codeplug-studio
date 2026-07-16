---
name: progress-tracking
description: >-
  Maintains progress and outstanding markdown logs for multi-session
  codeplug-studio work (multi-plan, multi-agent, multi-day, or multi-PR). Use
  when handoff or future continuation is likely, or when the user asks to update
  progress/outstanding docs. Skip for small single-phase tickets.
---

# Progress tracking (codeplug-studio)

Persistent **progress** and **outstanding** files preserve execution state when context is lost across **multi-plan**, **multi-agent**, **multi-day**, or **multi-PR** work. They are a handoff aid — not a ritual for every ticket.

---

## When to use vs skip

| Use progress + outstanding | Skip |
|----------------------------|------|
| Epic / migration / new feature area | Small single-phase ticket (one PR, one session) |
| Work likely to span multiple plans, agents, or days | Drive-by or plan that finishes in one sitting |
| Multi-PR initiative or high coordination / handoff risk | Single-commit or few-file fix |
| User asks for progress files, or files already exist for this initiative | No handoff risk and no future continuation expected |

**Default for small work:** skip. Do **not** create empty progress/outstanding pairs “just in case.”

**Create when future context is likely needed** — even mid-flight, if a small ticket grows into multi-session work, start the pair then and link it from the plan or issue.

[make-a-plan](../make-a-plan/SKILL.md) and [drive-by-ticket](../drive-by-ticket/SKILL.md) follow this same gate.

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

### At plan / drive-by start (only when this skill applies)

1. Read linked **progress** and **outstanding** files if they exist.
2. If this initiative needs tracking and files are missing, create both from the templates below.
3. In the Cursor plan (or drive-by notes), add a **Progress tracking** section pointing at both files.
4. If the ticket is small/single-phase, omit the section and do not create files.

### During execution (at logical breakpoints)

Update **progress** when:

- A commit or PR lands a coherent slice (match [git-workflow](../git-workflow/SKILL.md) atomic commits).
- A slice flips to **Complete** with PR/issue links.
- Manual verify steps or file paths change.

Update **outstanding** when:

- You skip or narrow scope and need a follow-up later.
- You discover a bug, doc error, or CPS quirk during the work.
- Local verification is blocked on something outside the current PR.

**Cadence** (only when files exist for this initiative):

| Initiative size | Typical updates |
|-----------------|-----------------|
| Medium (handoff risk, 2–4 commits across sessions) | After each user-visible slice; before PR |
| Large / phased / multi-PR | Per phase + before each PR |

**Always update progress before opening a PR** when this initiative uses progress files. Small tickets with no progress files skip this step.

**Before opening a PR:** confirm documentation deliverables per [documentation-deliverables.mdc](../rules/documentation-deliverables.mdc) (feature hub, sidecars, index row) — same PR as the code unless the plan explicitly split docs-only commits.

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
- Creating progress/outstanding files for a small single-phase ticket.
- Skipping progress files when multi-plan / multi-agent / multi-day continuation is likely.
- Letting progress go stale across PRs without a **Next** section.
