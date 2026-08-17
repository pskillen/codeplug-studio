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
group list, satellite transmitter, …). For the six CPS entity kinds
(channel, zone, scan list, talk group, contact, RX group list) that pattern
is **shipped as a single service** — call it, do not hand-roll a per-surface
checklist. Satellite transmitter names are a parallel, already-converged
family with their own resolver (see below).

The wire-preview rework series (#1213, #1217, #1219 — closes #956) landed
this. [references/audit-findings.md](references/audit-findings.md) is now
**historical evidence of the drift that motivated the rework**, not a
catalogue of live gaps — do not read it as "surfaces still needing fixing."

## The one entry point: `resolveWireNames`

`src/core/services/resolveWireNames.ts` (policy engine in
`resolveWireNamesCore.ts`) resolves every wire name for one entity kind
under one build/format/profile in a single call:

```ts
resolveWireNames({ build, library, entityKind, formatId, profileId }): WireNameResolution[]
```

Each `WireNameResolution` carries:

| Field              | Meaning                                                                 |
| ------------------ | ------------------------------------------------------------------------ |
| `libraryEntityId`  | The library row this resolution is for                                  |
| `libraryName`      | Unshortened library name                                                |
| `suggestion`       | Pure generated candidate — **never** sees this row's own override       |
| `override`         | This row's stored override, if any                                      |
| `effective`        | `override ?? suggestion`, limits re-applied per override-vs-suggestion policy |
| `limit`            | Profile name-length cap, when the format/profile models one             |
| `remediation`      | `'none' \| 'shortened' \| 'disambiguated' \| 'truncated' \| 'over_limit'` — what (if anything) fitting `effective` to `limit` required |

CPS serialisers (`formats/<format>/serialise.ts`) that already hold merged
`CpsExportOptions` call `resolveWireNamesFromOptions` from
`resolveWireNamesCore.ts` **directly** (not via `resolveWireNames.ts`) if the
calling module is itself registered in `registry.ts` — see the header
comment on `resolveWireNamesCore.ts` for the import-cycle reason. Preview
(`previewWireRows.ts`) and radio-io write projections call the
build-based `resolveWireNames()` wrapper. Do not write a third call site
that reimplements the fold.

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
suggestion. For the six CPS entity kinds this is `resolveWireNames`' job —
do not write a new pure-generator function for one of those kinds; extend
the resolver instead.

## Suggestions

A row may offer **zero, one, or several** candidate strings. Render each as
a **clickable, link-styled** string near the input — see
[`WireNameInlineEditor`](../../../src/app/components/builds/wirePreview/WireNameInlineEditor.md),
the shared component every surface below uses.

**One suggestion per identity, not per style.** Multiple suggestions are legitimate only
when they are genuinely different *source identities* for the same object (satellite
Familiar vs OSCAR). A generated name reflecting a different naming **style** — "callsign
only" vs "name only" vs "both shortened" — is a settings concern, not a per-row suggestion
list; the operator changes the build's Name style setting once, not per row.

**Explicit exception — channel export names:** a channel row's inline editor offers one
suggestion per `ChannelExportNameMode` (`callsign_name`, `callsign_only`, `name_only`,
`callsign_suffix` — `src/core/domain/channelNaming.ts`), each run through the same
limit/shorten/uniquify pipeline as the row's default suggestion
(`channelWireNameStyleSuggestions.ts`, reusing `channelWireNamePreviewExamples`
composition). This is a deliberate, human-approved exception for channels only
(ux-proposal.md §6a); it does not extend to zones, talk groups, contacts, scan lists,
or RX group lists.

**Clicking a suggestion only fills the draft input.** It must **not** commit
the change, persist an override, or close edit mode. The operator still has
to hit Save.

## Presentation

### List / read-only surfaces

Show the **effective** name, plus a
[`WireNameRemediationMarker`](../../../src/app/components/builds/wirePreview/WireNameRemediationMarker.md)
driven by `resolution.remediation` — not a blanket "was this shortened"
boolean. Clean shortening/disambiguation stays quiet (dimmed `≈`); only
`truncated`/`over_limit` (genuine information loss the operator didn't
choose) gets the orange warning triangle. No "Suggestion:" subline on list
rows — that only appears once the row is in edit mode.

### Inline vs modal — which surface edits a row

**Default: inline.** Row click does **not** open a modal. The Export name
cell (`WirePreviewExportNameCell`) swaps in place for a name-only edit:
label + remediation marker + pencil → `WireNameInlineEditor` with Save /
Revert, closes back to the label on commit.

**Modal only when a row has more than a name to edit**
(`WirePreviewOverrideModal`, gated by `rowClickOpensModal` in
`BuildWirePreviewListPage.tsx`): zones (Members / Scan tabs) and CHIRP
flat-memory channels (per-channel scan inclusion via `extraSections`). The
modal's wire-name field uses the **same** `WireNameInlineEditor`, not a
separate input — do not fork a second edit widget for the modal path.

Do not add a modal for a kind that only needs a name edit just because an
older surface used to have one — extend the inline cell instead.

### Bulk editing many items

- **Every row is visibly in edit mode** at once (input, not label).
- Edits accumulate as local drafts; there is **one page-level Save**
  that commits every dirty row in a single operation — not a per-row
  Apply button.
- Confirm before navigating away with any unsaved row.

## Resolution view — "why is it this?"

Every row's editing surface (inline cell while editing, or the modal) can
also show a **Resolution** section
([`WireResolutionSection`](../../../src/app/components/builds/wirePreview/WireResolutionSection.md),
composed via `src/app/lib/wirePreviewResolution.ts`): each exported field
next to the layer that decided its effective value. For wire names, the
layer is **derived from `WirePreviewRow.hasWireNameOverride` /
`.remediation`** — override set wins outright ("Row override"); a non-`none`
remediation with no override means a target constraint (length limit or
dedupe) changed the composed name; otherwise it's exactly what library data
+ build naming settings composed. This is **not** a fifth stored layer —
don't add one. Channel/zone behavioural fields (transmit, TX permit, talker
alias, analog squelch, zone-derived scan membership) reuse the existing
`resolve*WithLayer` cascades unchanged. The channels/zones wire-preview
lists also offer the same reading as optional hideable columns (off by
default). See
[wire-preview.md — Resolution view](../../../docs/features/builds/wire-preview.md#resolution-view).

This absorbed the former `/builds/:id/export-resolution` About page, which
is deleted.

## Egress (export / radio write)

- Override set → use it. Only deviate for a doc'd hard constraint (e.g. a
  fixed-width radio field that must literally fit `N` bytes) — and document
  that exception where the constraint lives, not as ad-hoc behaviour.
- No override → call `resolveWireNames` / `resolveWireNamesFromOptions`
  (CPS entities) resolved with the **same settings** preview used (build
  export settings / radio-target profile limits). If export and preview can
  disagree for the same build state, that is a bug, not a feature-specific
  choice.
- Limits (`N`, charset) come from the radio/format **limits module**
  (`src/core/radios/<mfr>/<model>/limits.ts` or format profile via
  `getProfileExportLimits`) — never a literal in UI or generator code.

## Satellite transmitter encoded names (parallel family)

Satellite transmitter names do not go through `resolveWireNames` (a
fixed-width radio field with its own shortener, not a CPS profile limit) but
follow the same shape: `resolveSatelliteTransmitterWriteNames` is the pure
per-transmitter resolver, `SatelliteEncodedNameCell.tsx` +
`SatelliteWireNameOverrideInput.tsx` are the inline editor, and
`src/app/lib/satelliteWireNameRemediation.ts` approximates
`WireNameRemediation` from the shortener's `nameTruncated` flag so it can
drive the same `WireNameRemediationMarker`. See
`docs/features/satellite-keps/name-shortening.md`.

## Anti-patterns

See [references/audit-findings.md](references/audit-findings.md) for the
historical catalogue this series fixed — useful as evidence of what drift
looks like, not as a checklist to re-derive. Do not reintroduce:

- Generator input that includes this row's own override (or an
  already-folded `assembled`/`effectiveWireName` value), so the
  "suggestion" isn't pure.
- Suggestion click that persists immediately instead of only filling the
  draft.
- A modal added for a kind that only needs a name edit.
- Bulk-edit surface that applies changes per row instead of one page-level
  Save.
- List view rendering a Suggestion subline under the effective name.
- Preview and the actual export/write path disagreeing on whether an
  override gets shortened/uniquified — if they can, that's a resolver bug.
- A hard-coded length/charset literal instead of reading the limits SoT.
- A new pure-generator function for a CPS entity kind `resolveWireNames`
  already covers.
- Inventing a stored "wire-name layer" field instead of deriving Resolution
  attribution from `hasWireNameOverride` / `remediation`.

## Retrospective checklist

When adding a new wire-name-bearing entity kind or surface:

- [ ] CPS entity kinds resolve through `resolveWireNames` /
      `resolveWireNamesFromOptions` — no parallel pure-generator path
- [ ] Preview and egress-without-override call the **same** resolver call
- [ ] List/read-only view shows effective name + remediation marker only
- [ ] Row edit: inline cell by default; modal only for more-than-a-name rows
- [ ] Bulk edit: all rows in edit mode, one page Save, not per-row Apply
- [ ] Suggestion click fills the draft only, never commits
- [ ] Unsaved-changes navigation guard present where edits are page-scoped
- [ ] Limits/charset read from the radio/format SoT module
- [ ] Only one override-keying scheme per entity kind (no dead alternates)
- [ ] Resolution view attribution (if added) derives from existing fields —
      not a new stored layer

## Related

- Evidence / historical audit: [references/audit-findings.md](references/audit-findings.md)
- `docs/features/builds/wire-preview.md`, `wire-name-composition.md` — product-level CPS wire naming
- `docs/features/satellite-keps/name-shortening.md` — satellite transmitter encoded names
- `src/core/services/resolveWireNames.ts`, `resolveWireNamesCore.ts` — the resolver
- `src/app/lib/wirePreviewResolution.ts`, `behaviourResolutionLabels.ts` — Resolution view
