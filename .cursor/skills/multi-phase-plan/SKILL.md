---
name: multi-phase-plan
description: >-
  Turns a rough brainstorm into a large, multi-phase, multi-PR delivery plan
  for an epic-sized feature in codeplug-studio: a high-level design doc,
  a ticket breakdown, a phase sequence, then self-contained per-phase plan
  files ready to hand to fresh agent sessions (or an orchestrator spawning
  sub-agents on stacked branches). Builds on make-a-plan and drive-by-ticket
  but for work too large or too tangled for either — a whole epic, a big
  chunk of boilerplate combined with some genuinely hard logic, anything that
  will span several PRs and possibly several agents or days. Use whenever the
  user wants to brainstorm a feature/epic under tmp/features/<name>/, break a
  big plan into phases or tickets, plan a multi-agent or multi-PR delivery,
  or asks for a phase-plan / ticket-management / hl-delivery-plan /
  AGENT-INSTRUCTIONS style breakdown — even if they just say "this is a big
  one, let's plan it properly" or "break this into phases." This is a
  multi-pass skill: expect to run it several times across a conversation (or
  several conversations) as work advances brainstorm → high-level plan →
  phases/tickets → concrete sub-plans → execution, stopping for review at
  each checkpoint rather than doing everything in one shot.
---

# Multi-phase plan (codeplug-studio)

Turns a user's scratch brainstorm into a fully-planned, multi-PR delivery series: a design doc, a ticket breakdown, a phase sequence, and — last — a set of self-contained plan files a fresh agent can execute one at a time. It is [make-a-plan](../make-a-plan/SKILL.md) and [drive-by-ticket](../drive-by-ticket/SKILL.md) scaled up for work neither is sized for: a whole epic, or a feature with a large amount of boilerplate combined with some genuinely hard logic in places.

This skill's templates and conventions were distilled from two real multi-phase series this repo ran through by hand before this skill existed (one under a `satellite/mvp-followups` slug, one under `satellite/spacecraft-multi-transciever`) — their prose density, self-containment discipline, and delivery mechanics are baked into the reference files below rather than linked out to. **Do not link to specific paths under `tmp/` from any skill file** — `tmp/` is gitignored scratch space and this repo scrubs it periodically, so a path that resolves today will 404 for a future reader. If you want to point at a *concrete example* while this skill is running, quote or excerpt the relevant lines inline in your response instead of leaving a bare path reference for later.

**Everything this skill produces lives under `tmp/features/<name>/`** — gitignored scratch space (`tmp/` is in `.gitignore`), not `docs/`. Nothing in this directory is committed to the repo, and its contents may not survive to a later session. It exists purely to carry planning state across agent sessions *while the series is active* — the durable record of what actually happened is the GitHub issues, the merged PRs, and (for anything behavioral) the `docs/` updates those PRs ship. Don't treat a `tmp/features/<name>/` file as a citable long-term reference once its series has shipped.

---

## This is a multi-pass skill — do one step, then stop

The single most important thing about this skill: **it is not a one-shot generator.** A real run of this process is a human reading and reacting to each artifact before the next one gets built. If you produce the design doc, the ticket breakdown, the phase plan, *and* the concrete per-phase plans all in one turn because the user asked a broad question ("plan out this epic"), you have skipped every review checkpoint the workflow exists to provide — the user cannot course-correct a decision buried three artifacts deep that they never saw.

**Do the step the user actually asked for. Then stop and hand back for review**, unless the user has explicitly said to keep going (e.g. "do the whole thing end to end," or "I've already reviewed this externally, go ahead to the next step"). When in doubt about whether you've been asked to advance a step, ask — don't infer it from adjacency.

Each time this skill is invoked (possibly in a brand-new session with no memory of prior turns), first work out **where the process currently stands** by reading what already exists on disk — see [Figure out where we are](#figure-out-where-we-are) below — then do the one step that's being asked for.

---

## Where everything lives

```
tmp/features/<name>/
  something.md                     # user's brainstorm — theirs, not yours (step 1)
  hl-delivery-plan.md               # high-level delivery / design plan (step 2)
  ticket-management.md              # ticket breakdown (step 4)
  phase-plan.md                     # phases: sequencing, branches, delivery model (step 4)
  plans/
    00-README.md                    # phase index — links, issues, order (step 7)
    01-first-step.md .. NN-*.md     # self-contained per-phase plans (step 7)
    01-first-step-handover.md       # per-phase handover, human-led model only
    AGENT-INSTRUCTIONS.md           # copy-paste kickoff prompt, one phase at a time
    ORCHESTRATOR-INSTRUCTIONS.md    # orchestrator-agent model only
    zz-final-handover.md            # whole-series wrap-up, written last
```

`<name>` is a short kebab-case slug for the feature/epic (e.g. `satellite/mvp-followups`). Nest under a domain subdirectory when one obviously applies.

---

## Figure out where we are

| What exists on disk | State | What's likely being asked next |
|---|---|---|
| Nothing, or just an empty dir | Not started | Ask the user to brainstorm first (or help them draft `something.md` collaboratively) — do not skip straight to a delivery plan from a one-line request. |
| `something.md` only | Brainstormed | Draft `hl-delivery-plan.md` — [reference](references/hl-delivery-plan.md). |
| `hl-delivery-plan.md` exists, no ticket/phase files | Design under review | Either revise the design doc in place (small ask), or — if asked — move to ticket/phase breakdown. |
| `ticket-management.md` + `phase-plan.md` exist, no GitHub issues linked | Breakdown under review | Revise in place, or — if asked — file the GitHub issues. |
| Issue numbers present in `ticket-management.md`/`phase-plan.md`, no `plans/` dir | Tickets filed | If asked, generate the concrete `plans/` series — [reference](references/concrete-plans.md). |
| `plans/00-README.md` + phase files exist | Ready to execute | Execution is a separate act per phase — see [Delivery models](#delivery-models) — not something you chain onto plan generation automatically. |
| Some `plans/NN-*-handover.md` exist, series not fully merged | Mid-execution (human-led) | Read the handover before touching anything — it has the state of the world as of the last agent, including deviations. |
| All phases merged | Done | If asked, write `plans/zz-final-handover.md` — [reference](references/handover.md#final-handover). |

If a file at the "current" state has open questions or a "not yet decided" marker in it, treat that as still mid-review — don't advance past it silently.

---

## The steps

### 1. Brainstorm (`something.md`) — user-authored

This is the user's own scratch thinking: thoughts, feelings, expected outcomes, half-formed constraints. You may be asked to help write it, but treat its content as ground truth for intent even where it's messy or contradictory — surface contradictions rather than silently resolving them in the next step.

### 2. High-level delivery plan (`hl-delivery-plan.md`)

Turn the brainstorm into a real design doc: problem statement, goal, proposed model/approach, consumer/call-site impact, migration concerns, open questions. See [references/hl-delivery-plan.md](references/hl-delivery-plan.md) for the template.

Explore the codebase before writing this — cite real file paths, real function signatures, real current behavior, not assumptions. Follow [AGENTS.md — Vendor boundaries](../../../AGENTS.md#vendor-boundaries) when the design touches library/CRUD/model shape.

**Stop here for review** unless told otherwise. Iterate on this doc in place as the user pushes back — do not regenerate it from scratch each round; edit it.

### 3. Review

Not an artifact — this is the user reading step 2's output and reacting. Your job during this step, if re-invoked, is to apply their feedback to `hl-delivery-plan.md` in place.

### 4. Ticket + phase breakdown (`ticket-management.md`, `phase-plan.md`)

Two documents, two different jobs — don't merge them into one file:

- **`ticket-management.md`** is ticket-shaped: what would become individual GitHub issues, grouped by area, with size/priority/acceptance criteria and a dependency graph. Not yet filed.
- **`phase-plan.md`** is delivery-shaped: how those tickets map onto PR-sized **phases**, what order they execute in, which [delivery model](#delivery-models) (human-led vs orchestrator), and the branch-naming/stacking strategy. No file links to `plans/` yet — that directory doesn't exist until step 7.

Template and the distinction in more depth: [references/ticket-management-and-phase-plan.md](references/ticket-management-and-phase-plan.md).

**Stop here for review.**

### 5. Review

Same as step 3, applied to `ticket-management.md`/`phase-plan.md`.

### 6. File the tickets

Only when asked. Use **`user-github`** MCP (never `gh`) per this repo's convention — see [git-workflow](../git-workflow/SKILL.md). File each ticket from `ticket-management.md`, parented per the doc's own suggestion (usually [Milestone 2 — #495](https://github.com/pskillen/codeplug-studio/issues/495) or an existing epic). Write the resulting issue numbers back into **both** `ticket-management.md` and `phase-plan.md` — don't leave one updated and the other stale.

### 7. Concrete per-phase plans (`plans/`)

Only when asked, and only after tickets are filed. Generate:

- `plans/00-README.md` — the phase index: a table of phase → file → what → branch → depends-on, plus the git-workflow rules that apply to every phase. This is `phase-plan.md`'s content made concrete, with real issue numbers and file links.
- `plans/01-*.md` .. `plans/NN-*.md` — one **fully self-contained** plan per phase. The defining property: a fresh agent with no other context should be able to execute the file *without reading any sibling phase file or the design doc*. Restate the exact current file paths, type shapes, and function signatures the phase needs, as of the state `main` will be in once earlier phases have merged.
- `plans/AGENT-INSTRUCTIONS.md` — copy-pasteable kickoff prompt for one phase at a time.
- `plans/ORCHESTRATOR-INSTRUCTIONS.md` — only if the phase plan chose the orchestrator delivery model.

Full templates: [references/concrete-plans.md](references/concrete-plans.md) (phase files, index) and [references/agent-instructions.md](references/agent-instructions.md) (kickoff prompts).

---

## Delivery models

Decided in `phase-plan.md` (step 4) — affects what gets generated in step 7 and how handover works. Ask the user which one applies if `phase-plan.md` doesn't already say; don't default silently, the two produce different `plans/` contents.

| | Human led | Orchestrator agent |
|---|---|---|
| Who runs each phase | A human pastes `AGENT-INSTRUCTIONS.md` into a fresh session per phase, one at a time | A single orchestrator agent invokes a sub-agent per phase, sequentially, itself |
| Context between phases | `plans/NN-phase-handover.md`, written by the phase's own agent before it finishes | Orchestrator carries context itself and passes it into the next sub-agent's prompt — no persisted per-phase handover file is required, though one doesn't hurt |
| Branch strategy | Each phase branches from `origin/main` once the prior phase's PR has actually merged | Phase 1 branches from `origin/main`; phase *N* (N>1) branches from phase *N-1*'s branch — **stacked**, not from `main`, since the orchestrator doesn't wait for a human to merge between phases |
| Merges as PRs land | Yes, likely, as the human drives | Not necessarily — PRs may stay stacked until the human reviews and merges the whole stack |
| Use when | Some phases are pure boilerplate, some need a specialist/expensive model, or the human wants to inspect each PR before the next starts | The phases are mechanical enough to trust end-to-end, and the human wants the whole series delivered with minimal per-phase intervention |

**Claude Code note for the orchestrator model:** the `Agent` tool's `isolation: "worktree"` option is the natural mechanism for stacked-branch phases — it gives each sub-agent an isolated git worktree so phase *N* can be checked out from phase *N-1*'s branch without disturbing the orchestrator's own working tree. Each `Agent` invocation starts cold (no memory of prior sub-agents), so the orchestrator must explicitly pass forward: which branch to start from, what the prior phase actually did (including any deviations from its plan file), and anything the next phase needs that the plan file alone doesn't capture. The orchestrator model has no track record in this repo yet — treat its instructions as a reasoned first attempt, not a battle-tested pattern, and note in `zz-final-handover.md` anything that didn't work as expected so the next attempt improves on it.

Per-phase handover (human-led) and whole-series final handover: [references/handover.md](references/handover.md).

---

## Shared conventions

Pull these from the skills this one builds on rather than restating them:

- **Branch naming, commit checkpoints, PR conventions:** [git-workflow](../git-workflow/SKILL.md) — `{num}/{author}/{short-slug}`, atomic conventional commits, `user-github` MCP not `gh`.
- **Git workflow / Documentation mandatory plan sections:** [make-a-plan](../make-a-plan/SKILL.md) sections 4–5 — every concrete phase file needs both, adapted to that phase's specific branch and issue.
- **Progress/outstanding files:** [progress-tracking](../progress-tracking/SKILL.md) — only add these (in `docs/`, not `tmp/`) if a phase's own execution needs multi-session handoff *beyond* what the phase's plan file and this series' handover docs already provide. Most phases won't need them; don't create them reflexively.
- **Feature docs:** [feature-docs](../feature-docs/SKILL.md) — the doc-update phase (usually the last phase in the series) follows this.
- **Vendor boundaries:** [AGENTS.md](../../../AGENTS.md#vendor-boundaries) — applies throughout design and phase planning, not just at execution.

---

## Anti-patterns

- Producing the design doc, ticket breakdown, phase plan, and concrete plans all in one turn because the user asked something broad. Do the step asked for; stop.
- Regenerating an artifact from scratch on every review round instead of editing it in place.
- Merging `ticket-management.md` and `phase-plan.md` into one file — they answer different questions (what tickets exist vs. how delivery is sequenced).
- Writing a `plans/NN-*.md` phase file that assumes the reader has also read the design doc or sibling phase files. If a fresh agent given only that one file would get stuck, it isn't self-contained yet.
- Generating `plans/ORCHESTRATOR-INSTRUCTIONS.md` when the phase plan chose human-led delivery, or vice versa.
- Skipping straight to filing GitHub issues or generating `plans/` before the user has actually reviewed the artifact that precedes it.
- Treating `tmp/features/<name>/` content as something that needs a commit — it's gitignored scratch space; the *tickets* and *code* it produces are what get committed.
- Writing a phase file at the level of "improve the UI" instead of restating exact field names, function signatures, and concrete acceptance criteria — vague phase files are not what this skill produces; a fresh agent should never have to guess.
