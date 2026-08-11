# `plans/00-README.md` and `plans/NN-*.md` — templates

The property that matters most here is **self-containment**, described in detail below — get that right and the rest of the structure follows.

---

## `plans/00-README.md` — the phase index

```markdown
# <Feature/epic name> — plan series index

Execution plans for [<Epic #NNN>](issue-url), <parent context>. Design
rationale: [../hl-delivery-plan.md](../hl-delivery-plan.md). Ticket
breakdown: [../ticket-management.md](../ticket-management.md). Phase
sequencing: [../phase-plan.md](../phase-plan.md).

**N phases, one PR each<, stacked | , sequential from main>** — <branch
strategy per phase-plan.md's Delivery model section>. Each plan file is
written so a fresh agent session can execute it **without reading any other
phase file** — it restates the exact current file paths, type shapes, and
function signatures it needs, as of the state `main` will be in when that
phase starts (i.e. after all earlier phases are merged).

<Any explicit exclusions carried through from hl-delivery-plan.md's Out of
scope / open questions — e.g. "no radio-write work in this series.">

## Phases

| # | File | What | Branch | Depends on |
| --- | --- | --- | --- | --- |
| 1 | [01-first-step.md](01-first-step.md) | <summary> | `<issue>/<author>/<slug>` | — |
| 2 | [02-second-step.md](02-second-step.md) | <summary> | `<issue>/<author>/<slug>` | 1 |
| ... | | | | |

**Suggested order:** <same reasoning as phase-plan.md, restated with real
file links now that they exist.>

## Git workflow (applies to every phase)

- Repo: `pskillen/codeplug-studio`. Use **user-github MCP** — never `gh`.
- Branch from `origin/main` <or: from the prior phase's branch, if
  stacked>, using the branch name in the table above.
- Atomic conventional commits at each checkpoint listed in the phase file.
- **Before opening the PR:** `npm run format` (commit any drift), then
  `npm run format:check && npm run lint && npm run test && npm run build`,
  all green.
- One PR per phase via user-github MCP, `Closes #<issue>`.
- Docs ship in the same PR as the behavior they describe, per
  [documentation-deliverables.md](../../../../.claude/rules/documentation-deliverables.md).

## Agent instruction template

[AGENT-INSTRUCTIONS.md](AGENT-INSTRUCTIONS.md) — copy-paste prompt for
kicking off a fresh agent session on any one phase.
```

If reality has drifted since `hl-delivery-plan.md` was approved (e.g. a dependency shipped early, or a sibling feature landed that changes a later phase's starting assumptions), add an explicit "scope correction" note at the top of `00-README.md` rather than letting individual phase files quietly disagree with the design doc.

---

## `plans/NN-name.md` — one phase, fully self-contained

```markdown
# Plan: <phase title>

**Phase N of <total>** in the <series name> series. This file is
self-contained — you do not need to read the other phase files or the
design doc to execute it, though [../hl-delivery-plan.md](../hl-delivery-plan.md)
has the full rationale if you want it.

**Tracking:** [#NNN](issue-url) (parent epic [#MMM](issue-url))
**Branch:** `<issue>/<author>/<slug>` (from `origin/main` | from `<prior-branch>`)

---

## Context

<Why this phase exists, what it changes, and — critically — what it
deliberately does NOT change (deferred to a later phase). State the
"leave the codebase compiling and green by the end of this phase" invariant
explicitly if earlier phases in the series need it (see the reference
example's phase 1, which touches many call sites but does only the minimal
fix at each one).>

**Vendor-neutral internal model note (per AGENTS.md/DESIGN.md):** <state
explicitly what stays vendor-neutral here, if the phase touches
library/model/CRUD shape.>

## Current state (verify before starting — this is a snapshot, re-check if it's drifted)

<Real code excerpts of exactly what exists today at the file paths this
phase touches, with line-number ballparks. This is what makes the file
self-contained — a fresh agent shouldn't need to go spelunking to find out
what it's changing. Explicitly list every known call site that will need a
matching change or will break, even ones this phase only minimally patches.>

## Slice 1: <name>

<Concrete steps, real code where it clarifies shape.>

**Commit checkpoint:** `<type>(<scope>): <message>`

## Slice 2: <name>

...

**Commit checkpoint:** `<type>(<scope>): <message>`

## Test plan

- [ ] <specific, checkable — not "add tests">
- [ ] `npm run format:check && npm run lint && npm run test && npm run build`
- [ ] `npm run dev` — exercise the affected route(s) live, when UI-facing

## Out of scope

<Explicit deferrals to later phases — and why deferring is correct, not
just "not doing this now.">

## Cross-phase note

<What later phases depend on this phase's exact output shape — field names,
function signatures — that they'd break if renamed. This is the one place a
forward reference to a sibling phase number is acceptable; it's a warning
for whoever edits this phase later, not a read-this-first pointer for
whoever executes it.>
```

### What "self-contained" actually means in practice

The test: hand *only this one file* (not the series README, not the design doc, not sibling phase files) to a fresh agent with no other context. Could it execute the phase correctly? If executing it correctly requires knowing something that lives only in a sibling file, that fact needs to be copied (not linked) into this file's Context or Current state section.

This is why these files run long and repeat information across the series — a `SatelliteTransmitter` field list might appear near-verbatim in three different phase files. That's intentional, not duplication to clean up.

### Reuse make-a-plan's mandatory sections

Every phase file still needs the substance of [make-a-plan](../../make-a-plan/SKILL.md)'s mandatory **Git workflow** and **Documentation** sections — commit-as-you-go, format/lint/test/build before PR, docs shipped in the same PR as behavior. In a phase series these are usually hoisted up into `plans/00-README.md`'s "Git workflow (applies to every phase)" section instead of repeated verbatim in every phase file — reference it from each phase file rather than choosing one or the other inconsistently across the series.
