# `hl-delivery-plan.md` — template

This is the design doc a reader approves *before* anything gets broken into tickets. Aim for the density of a real engineering RFC, not a summary of the brainstorm — exact current field types, exact function signatures, exact file paths, explicit reasoning about invariants that must be preserved. Don't link to a specific past example from `tmp/` here — that directory is gitignored scratch space this repo scrubs periodically, so a path that resolves today won't for a future reader. If you want to show the user what "good" looks like while this skill is running, quote a snippet inline instead of leaving a path reference behind.

Explore the actual codebase before writing any of this — every claim below should be checkable against real files, not inferred from the brainstorm alone. A design doc that cites a type shape or function signature that turns out not to match the real code will cost the whole series credibility at review time.

## Structure

```markdown
# <Feature/epic name> — high-level delivery plan

**Status:** proposal, not yet filed as GitHub issues.
**Source:** [tmp/features/<name>/something.md](something.md)<if relevant, links to prior related tickets/PRs>

---

## Problem

<What's broken, missing, or backwards about the current state. Cite real files
and real current behavior — not the brainstorm's framing, the actual code's.>

## Goal

<One or two paragraphs: what "done" looks like, stated as an invariant or
outcome, not a task list.>

---

## Proposed model / approach

<The actual design: new types, new functions, changed call sites. Real code
snippets where they clarify shape. This is the section most worth spending
time on — the ticket breakdown in step 4 is a mechanical decomposition of
whatever's decided here.>

## UI changes  <!-- omit if none -->

<Per-component/route changes, described concretely enough that a reader can
picture the resulting screen.>

## Consumer changes

<Table: file → what it does today → what it becomes. This is usually the
most useful section for scoping tickets later — it's a checklist of every
call site the change touches.>

## Migration  <!-- omit if no persisted-schema impact -->

<Schema version bump, migration branch behavior, fixture regeneration.>

## Open questions

<Flag, don't unilaterally decide, anything genuinely ambiguous. Number them —
step 4's ticket breakdown should resolve or explicitly assign each one to a
specific ticket rather than leaving it to drift.>

---

## Files touched (reference for planning)

<Flat list by layer — core / app / docs — of every file this design expects
to touch. This becomes the raw material for "Files touched" per phase in
step 7; keep it accurate as the design evolves through review.>
```

## What makes this good vs. thin

A good version of this doc reasons explicitly about invariants that must be preserved — e.g. "pass geometry is computed once per satellite, independent of frequency data, confirmed by reading the function's signature and types" is the right level of specificity; "this shouldn't affect pass calculation" is not. A thin version — one that just restates the brainstorm in nicer prose without touching the actual code — will produce a thin, unreviewable ticket breakdown in step 4. Do the exploration now; it's cheaper here than rediscovered per-phase later.

Naming matters: if the brainstorm and the existing codebase use different vocabulary for the same concept (e.g. the user's brainstorm calls something a "radio" but the codebase already uses that word for a different concept, and has an existing term — "transmitter," say — that actually fits), resolve it explicitly in its own subsection with the reasoning, not silently in a code snippet.
