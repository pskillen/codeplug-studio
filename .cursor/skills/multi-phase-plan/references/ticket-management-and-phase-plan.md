# `ticket-management.md` and `phase-plan.md` — templates

Two files, two different questions. Keep them separate — don't fold the phase sequencing into the ticket doc or vice versa.

---

## `ticket-management.md` — what tickets exist

Answers: *if this design were approved, what would the individual GitHub issues be?* Not filed yet.

```markdown
# Proposed tickets — <feature/epic name>

Not yet filed as GitHub issues. See [hl-delivery-plan.md](hl-delivery-plan.md) for
the full design rationale. Sizes are rough (S = one small PR, M = a few slices,
L = multi-PR mini-series).

**Suggested parent:** <existing epic, or a new one under Milestone 2 #495>

---

## <Group A — e.g. "Model and foundation">

### A1. <Ticket title>
**Size:** M · **Priority:** P1 (blocks everything else)

<What this ticket does, linking back to the relevant hl-delivery-plan.md section.>

- [ ] Acceptance: <concrete, checkable>
- [ ] Acceptance: <concrete, checkable>
- [ ] Unit tests: <what gets covered>

### A2. <Ticket title>
**Size:** S · **Priority:** P2 · **Depends on:** A1

...

---

## Suggested implementation order

<Dependency graph — an ASCII tree or table is fine, doesn't need to be a
diagram tool. Note which tickets are independent of each other and can run
in parallel once their shared prerequisite lands.>

## Not included here — future/dependent work

<Explicitly out-of-scope items adjacent to this work, and why. Also flag
anything this series creates that a *different*, not-yet-planned piece of
work will need to be aware of.>
```

**Acceptance criteria are load-bearing.** Each one should be checkable by someone who didn't write the ticket — "operator can add a manual row, fill it in, save, and see it persist," not "the editor works correctly."

**Dependency notation** (`Depends on: A1`) needs to be accurate — step 7's phase files inherit these as hard prerequisites for branching order.

---

## `phase-plan.md` — how delivery is sequenced

Answers: *given those tickets, how many PRs, in what order, delivered how?* This is the delivery-mechanics half — it decides the [delivery model](../SKILL.md#delivery-models) and branch strategy, which step 7 then turns into concrete branch names and a real `plans/00-README.md`.

```markdown
# <Feature/epic name> — phase plan

Sequencing plan for the tickets in [ticket-management.md](ticket-management.md).
Design rationale: [hl-delivery-plan.md](hl-delivery-plan.md).

---

## Delivery model

**Chosen:** Human led | Orchestrator agent

<Why this one — e.g. "some phases (docs) are pure boilerplate, phase 3 needs
careful UI judgment, so human-led lets a stronger model take that phase
specifically" or "phases are mechanical enough end-to-end, orchestrator can
run the whole stack.">

## Phases

| # | Tickets covered | What | Depends on |
| --- | --- | --- | --- |
| 1 | A1 | <model + migration> | — |
| 2 | A2 | <merge logic> | 1 |
| 3 | B1 | <editor UI> | 1, 2 |
| ... | | | |

<One phase is usually one PR. A ticket sized L in ticket-management.md may
need to become more than one phase — split it here, not silently during
step 7.>

## Suggested order

<Same dependency reasoning as ticket-management.md's, but now about phases,
not tickets — which phases are strictly sequential vs. can run in parallel
(multiple phases in flight at once, whether that's two humans, or two
sub-agents in the orchestrator model).>

## Branch strategy

<Confirm which pattern applies, per the delivery model above:
- Human led: each phase branches from `origin/main` once the prior phase's
  PR has actually merged.
- Orchestrator: phase 1 from `origin/main`; phase N (N>1) from phase N-1's
  branch, stacked, not waiting for merge.>
```

No file links to `plans/` here — that directory doesn't exist until step 7. This file is the plan *for* generating that directory, not the directory's index.

## Keeping both in sync

When GitHub issues get filed (step 6), write the resulting issue numbers into **both** files — `ticket-management.md`'s ticket entries and `phase-plan.md`'s phase table. A phase-plan row with no matching filed issue is a sign step 6 was only partially done.
