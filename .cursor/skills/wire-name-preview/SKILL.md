---
name: wire-name-preview
description: >-
  The one intended pattern for previewing, generating, overriding, and
  exporting/writing any wire-format name in Codeplug Studio — CPS channel/zone/
  talk-group/contact/RX-list names, radio-io org names, and satellite
  transmitter encoded names. Use when adding or changing a build-scoped
  override field, a name-shortening/generation function, a wire preview list
  or edit UI, or an export/radio-write path that resolves a wire name.
---

# Wire name preview & override

One pattern applies everywhere a name gets written to a CPS file or radio,
regardless of entity granularity (channel, zone, talk group, contact, RX
group list, satellite transmitter, …). Existing surfaces diverge from it in
places — see [references/audit-findings.md](references/audit-findings.md)
for the concrete catalogue. Treat that document as evidence of drift, not as
alternative patterns to preserve.

## Data model

- Sparse override array on the build (`BuildEntityOverride[]` or an
  entity-specific equivalent), keyed by **whatever id is being written** —
  library entity id, a projection key (multi-mode/m×n row), or a sub-entity
  id (e.g. satellite transmitter).
- Presence of a non-empty override value = pinned. Absent / empty = generated.
- **`effective = override?.trim() || generated`** — one fold, at the edge.
  Never persist `''`; treat it as "no override" and delete the row (unless
  other field overrides in use).

## Generation must be pure

The generator takes **library fields + build/radio/format settings only**.
It must **never** receive this row's own override as input. Other rows'
overrides may still be reserved (for uniqueness) while generating this row's
suggestion.

There is **one** generator function per entity kind, and it is called from
both places:

1. Preview / edit UI (to compute the suggestion(s) shown to the operator).
2. Export / radio-write, for any row with no override.

Do not let preview and export diverge into two implementations, and do not
feed `assembled`/already-override-folded values back into the generator —
that produces a "suggestion" that is really `shorten(override)` in disguise.

## Suggestions

A row may offer **zero, one, or several** candidate strings from the pure
generator (e.g. a single Suggestion; or "Familiar" + "OSCAR" alternates).
Render each as a **clickable, link-styled** string near the input.

**Clicking a suggestion only fills the draft input.** It must **not** commit
the change, persist an override, or close edit mode. The operator still has
to hit Save. (Several existing components commit on suggestion-click today —
that is the anti-pattern to fix, not the pattern to copy.)

## Presentation

### List / read-only surfaces

Show the **effective** name only. No "Suggestion:" subline, no
generated-name preview. If the operator wants to see or change the
generated value, they open the edit surface. In some situations we show
the library (original unshortened) and override in e.g. a table - this is
acceptable and by design.

### Editing one item, or a few, at a time

- **Default state:** a label showing the effective name, with an edit
  icon/button next to it. Rows are **not** pre-opened into edit mode.
- **On click:** the label swaps for an input (draft = effective name; when
  there is no override, draft is empty and the input's **placeholder**
  shows the generated value) plus **Save** and **Revert** controls, and any
  suggestion links.
- **Save** commits the draft as the override (trim; empty clears the
  override and reverts to live generation). **Revert** discards the draft
  and closes edit mode without persisting anything.
- Nothing persists from a suggestion click alone — only Save does.
- Confirm before navigating away with an unsaved edit open.

### Bulk editing many items

- **Every row is visibly in edit mode** at once (input, not label).
- Edits accumulate as local drafts; there is **one page-level Save**
  that commits every dirty row in a single operation — not a per-row
  Apply button.
- Confirm before navigating away with any unsaved row.

## Egress (export / radio write)

- Override set → use it. Only deviate for a doc'd hard constraint (e.g. a
  fixed-width radio field that must literally fit `N` bytes) — and document
  that exception where the constraint lives, not as ad-hoc behaviour.
- No override → call the **same pure generator** used in preview, resolved
  with the **same settings** the preview used (build export settings /
  radio-target profile limits). If export and preview can disagree for the
  same build state, that is a bug, not a feature-specific choice.
- Limits (`N`, charset) come from the radio/format **limits module**
  (`src/core/radios/<mfr>/<model>/limits.ts` or format profile) — never a
  literal in UI or generator code.

## Anti-patterns

See [references/audit-findings.md](references/audit-findings.md) for the
full catalogue with file/line evidence. Headlines:

- Suggestion click persists immediately instead of only filling the draft.
- Generator input includes this row's own override (or an already-folded
  `assembled` value), so the "suggestion" isn't pure.
- Bulk-edit surface applies changes per row instead of one page-level Save.
- List view renders a Suggestion subline under the effective name.
- Preview and the actual export/write path disagree on whether an override
  gets shortened/uniquified.
- A serial/radio-io egress path ignores build export settings that the CPS
  CSV path for the same entity honours.
- A hard-coded length/charset literal instead of reading the limits SoT.
- Dead resolver functions left behind after a design changes which key
  (entity vs sub-entity) an override is keyed by.

## Retrospective checklist

When aligning an existing entity kind / surface to this pattern:

- [ ] Generator is pure (no override in its input)
- [ ] Preview and egress-without-override call the **same** generator call
- [ ] List/read-only view shows effective name only
- [ ] Single/few-item edit: label + edit icon → input + Save/Revert, not
      always-on input
- [ ] Bulk edit: all rows in edit mode, one page Save, not per-row Apply
- [ ] Suggestion click fills the draft only, never commits
- [ ] Unsaved-changes navigation guard present where edits are page-scoped
- [ ] Limits/charset read from the radio/format SoT module
- [ ] Only one override-keying scheme per entity kind (no dead alternates)

## Related

- Evidence / current-state audit: [references/audit-findings.md](references/audit-findings.md)
- `docs/features/builds/wire-preview.md`, `wire-name-composition.md` — product-level CPS wire naming
- `docs/features/satellite-keps/name-shortening.md` — satellite transmitter encoded names
