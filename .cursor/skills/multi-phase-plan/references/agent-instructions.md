# `plans/AGENT-INSTRUCTIONS.md` and `plans/ORCHESTRATOR-INSTRUCTIONS.md` — templates

## `AGENT-INSTRUCTIONS.md` — always generate this one

This is a **copy-paste prompt template**, not prose about the series. One block, `<N>` substituted per phase, meant to be pasted verbatim into a fresh agent session (human-led model) — or adapted into the orchestrator's own sub-agent prompt (orchestrator model, see below).

```markdown
# Agent instruction template

Copy the block below into a fresh agent session to execute one phase.
Replace `<N>` (appears twice: the zero-padded file number and the phase
number in prose) with the phase you're starting. Nothing else needs editing.

---

​```
Read and execute tmp/features/<name>/plans/0<N>-*.md in the codeplug-studio
repo (glob it — the exact filename has a descriptive suffix after the
number). This is phase <N> of a <total>-phase plan series; the file is
fully self-contained, so do not read sibling phase files, the series README
(00-README.md), or the design doc (../hl-delivery-plan.md) unless the phase
file itself tells you to for a specific detail — everything you need to
execute is in that one file.

Before starting: read AGENTS.md and DESIGN.md at the repo root (required
for every change in this repo, per .claude/rules/codeplug-studio.md), and
confirm the branch/dependency preconditions stated at the top of the phase
file are actually met on origin/main (i.e. earlier phases this one depends
on have really merged) — if they haven't, stop and tell me rather than
proceeding on stale assumptions.

Follow the phase file's slices in order, committing at each checkpoint it
specifies (atomic conventional commits). If the phase file's line numbers
or code snippets have drifted from what you find in the actual files, trust
the actual files and adapt — the snippets are a snapshot for orientation,
not a diff to apply literally.

Run the phase file's full test plan before opening a PR, including
npm run format:check && npm run lint && npm run test && npm run build.
Open the PR via the user-github MCP (not gh) targeting main, using the
branch name and Closes #<issue> the phase file specifies, once everything
is green.

If you hit a genuine ambiguity the phase file doesn't resolve, make the
smallest reasonable call and note it clearly in the PR description rather
than blocking — but if it's a decision that changes the shape of the model
or a public component API in a way later phases depend on, stop and ask
first.
​```
```

Adjust the "Closes #<issue>" line if the series uses stacked branches targeting a prior phase's branch instead of `main` (orchestrator model) — say so explicitly in the block, don't leave it implying every PR targets `main` when it doesn't.

---

## `ORCHESTRATOR-INSTRUCTIONS.md` — only when `phase-plan.md` chose the orchestrator model

There's no track record for this model in the repo yet — every phase series so far has used human-led delivery. Draft this with that in mind: it's a reasoned first attempt at the mechanics, not a pattern to follow blindly. Note anything that doesn't work as expected in `zz-final-handover.md` so the next series' version improves on it.

This file is the **orchestrator's own instructions** — what a single agent reads before it starts spawning sub-agents for each phase in sequence.

```markdown
# Orchestrator instructions — <feature/epic name>

You are running the <name> phase series end-to-end. Read
[00-README.md](00-README.md) first for the phase table and dependency
order. Do not read individual phase files yourself beyond what's needed to
brief each sub-agent — each phase's sub-agent reads its own file.

## Per-phase loop

For each phase in the order given by 00-README.md's dependency table:

1. **Determine the branch to start from.** Phase 1 branches from
   `origin/main`. Phase N (N>1) branches from phase N-1's branch — do not
   wait for a human to merge it first. Confirm phase N-1's branch actually
   exists and has the expected commits before starting phase N's sub-agent.
2. **Spawn a sub-agent for the phase** (in Claude Code: the `Agent` tool,
   `isolation: "worktree"` so the phase gets its own working tree cut from
   the right branch). Each spawn starts cold — the prompt must be
   self-contained. Base it on
   [AGENT-INSTRUCTIONS.md](AGENT-INSTRUCTIONS.md)'s block, plus:
   - The branch to start from (from step 1).
   - A short summary of what the prior phase(s) actually did, **including
     any deviations from their own plan files** — pull this from the prior
     phase's PR description or handover if one exists. A sub-agent that
     only reads its own phase file will miss a prior phase's ad-hoc
     decisions that this phase now depends on.
3. **Wait for the sub-agent to finish** (PR opened, per its own exit
   criteria) before starting the next phase that depends on it. Phases with
   no dependency relationship between them (see 00-README.md's table) may
   run concurrently if you're confident about it — but two sub-agents
   editing overlapping files concurrently is a real risk; when unsure, run
   sequentially.
4. **Do not merge PRs yourself** unless the user has explicitly said the
   whole stack should auto-merge. Default: leave the stack open for human
   review, report the PR chain, and stop.

## If a sub-agent gets stuck or deviates significantly

Don't silently improvise on its behalf. Either resolve it yourself if it's
within the scope this file already covers, or surface it to the user and
pause the series — don't let a wrong turn in phase 3 propagate silently
into phases 4 through N.

## When the series completes

Write [zz-final-handover.md](zz-final-handover.md) per
[the handover template](handover.md#final-handover) —
summarize what shipped, detail every deviation from plan, and call out
anything about the orchestration itself (not just the feature) that should
change next time.
```

Adapt the `Agent` tool specifics if the orchestrating agent isn't running in Claude Code — the underlying requirement (cold-start sub-agents need explicit prior-phase context passed forward, not assumed) holds regardless of tooling.
