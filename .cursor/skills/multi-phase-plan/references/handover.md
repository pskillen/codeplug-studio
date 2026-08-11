# `plans/NN-phase-handover.md` and `plans/zz-final-handover.md` — templates

Both exist for the same reason: the next reader (human or agent) has **not** read the prior session's conversation. Say what they'd otherwise have to reconstruct from scratch.

---

## `plans/NN-phase-handover.md` — human-led model, one per phase

Written by the phase's own executing agent, **before** it finishes, once its PR is open. Feeds the next phase's fresh agent session alongside that phase's own plan file.

```markdown
# <Phase title> — handover

**Written:** <date>, immediately after opening [PR #NNN](pr-url)
(`<branch>` → `main` | `<prior-branch>`). PR was **open, not yet merged** at
write time — check its actual state before starting the next phase.

---

## What shipped in this phase

<Concise — the phase file already has the detail. Link the PR; don't repeat
its diff in prose.>

## Deviations from the phase file

<Anything that didn't go exactly as the plan file described — a file that
had moved, a type shape that had drifted, a decision the plan file left
ambiguous and how it got resolved. This is the section that matters most:
if nothing deviated, say so explicitly rather than leaving the reader to
wonder if you checked.>

## Things the next phase needs to know

<Load-bearing gotchas discovered during this phase — build quirks,
non-obvious library behavior, anything that would cost the next agent real
time to rediscover. Only include what's actually load-bearing; this isn't a
diary.>

## Anything only partially done

<Be explicit about partial/skipped scope from this phase's own test plan or
acceptance criteria — don't let "mostly done" get reported as "done."
Whatever's incomplete either needs the next phase to pick it up, or needs a
follow-up ticket filed now.>
```

Keep this short — a single phase's handover should be a fraction of the length of a whole-series final handover (below). If it's growing to that size, the phase itself may have been too large for one PR.

---

## `plans/zz-final-handover.md` — written once, at the end of the whole series

Written after the last phase has merged (or, orchestrator model, after the whole stack is ready for human review). This is the artifact the brainstorming notes for this skill specifically call out: **mention it in the chat summary when it's written, and call out any high-priority items directly** — don't let it be a file the user has to go looking for.

```markdown
# <Feature/epic name> — final handover

**Written:** <date>. Series: [00-README.md](00-README.md). All N phases
<merged to main | stacked, pending review — state which>.

---

## What shipped

<Brief — table of phase → ticket → PR. This part should be short; the
interesting content is below.>

## Deviations from plan

<This is the section to spend real effort on. For each phase that deviated
from its own plan file or from hl-delivery-plan.md's original design,
explain what changed and why. Aggregate the per-phase handover docs here
rather than requiring the reader to open all N of them — but don't lose
detail in the process; "some things changed" is not acceptable, "phase 4's
merge semantics ended up X instead of Y because Z" is.>

## Gaps and follow-ups

<Anything left undone, whether by explicit "out of scope" calls made
mid-series or genuine gaps discovered late. Break into two kinds:
- **Suggested follow-up tickets:** file these (user-github MCP) if the user
  wants them filed now, or list them ready-to-file if not.
- **Gap descriptions with no clean ticket yet:** things worth knowing about
  even without a concrete next action.>

## High priority

<Pull anything from Gaps and follow-ups that's actually urgent — a real bug,
a broken invariant, a security/vendor-boundary concern — up to the top
here explicitly. This is what must make it into the chat summary; don't
bury it at the bottom of a long doc.>
```

## Orchestrator model addendum

If the series used the orchestrator model, `zz-final-handover.md` should also cover the **orchestration itself**, not only the feature: did stacked branches behave as expected, did any sub-agent need context the orchestrator failed to pass forward, did any two phases turn out not to be as independent as `phase-plan.md` assumed. This repo has no prior orchestrator-model run to compare against — this feedback is what makes the next one better.
