# Wire name preview — current-state findings

Snapshot from an audit done after [PR #1096](https://github.com/pskillen/codeplug-studio/pull/1096)
(`feat(satellite-keps): per-transmitter wire names and inline editor`, closed
[#1090](https://github.com/pskillen/codeplug-studio/issues/1090)). Two
implementation families exist today; both should converge on
[SKILL.md](../SKILL.md), not stay as separate "patterns."

Full working notes (not shipped, gitignored under `tmp/`):
`tmp/features/wire-preview-name-default/audit.md`.

## CPS entities (channels, zones, scan lists, talk groups, RX group lists, contacts)

**Storage:** `channelOverrides`, `zoneOverrides`, `scanListOverrides`,
`talkGroupOverrides`, `rxGroupListOverrides`, `contactOverrides` on
`RadioBuild` (`src/core/models/radioBuild.ts`), each a
`BuildEntityOverride[]` with sparse `wireName?`.

**Generation entry points:**

| Symbol | Path | Notes |
| --- | --- | --- |
| `defaultChannelWireName` / `composeChannelWireName` | `src/core/domain/channelNaming.ts` | Channel base from callsign/name + name mode |
| `assembledChannelExportWireName` / `applyWireNameLimits` | `src/core/import-export/channelExpansion/exportWireNames.ts` | Channel final name |
| `applyTalkGroupWireNameLimits` / `buildTalkGroupWireNameMap` | `talkGroupWireNames.ts` | Talk groups + abbreviation |
| `applyListWireNameLimits` / `buildListWireNameMap` | `listWireNames.ts` | Zones, scan lists, RX lists |
| `resolveDigitalContactExportBaseName` / `applyDigitalContactExportWireName` | `digitalContactExportName.ts` | Contacts |
| `previewWireRows` | `src/core/services/previewWireRows.ts` | Preview-side entry point |
| `assemble.ts` | `src/core/services/assemble.ts` | Export-side fold-in |

**UI:** `WireNameOverrideInput.tsx` (modal / bulk edit), `WirePreviewDataTable.tsx`
(list), `WirePreviewBulkEditTable.tsx` (bulk).

### Divergences from the intended pattern

- **Polluted generator input.** Zones, RX group lists, and Anytone scan
  lists feed `assembled.wireName` (which already folds in the override)
  into the shortener before showing it as a "suggestion." Contacts:
  `resolveDigitalContactExportBaseName` returns the override first if set.
  Only the plain channel path (`previewGeneratedChannelWireName`) is pure.
- **Suggestion click commits immediately.** `WireNameOverrideInput.applyDefault`
  calls `onWireNameChange` (persists) as soon as the "Default" link is
  clicked — should only fill the draft.
- **List shows a suggestion subline.** `WirePreviewDataTable` renders
  `Default: {generatedWireName}` under the effective name whenever an
  override is set; list surfaces should show effective-only.
- **Bulk edit applies per row.** `WirePreviewBulkEditTable` uses the same
  per-row Apply/Revert as the single-item modal; there is no single
  page-level Save that commits every dirty row together.
- **Override shortening policy differs by format.** Preview and the
  Anytone export path leave an override un-shortened; CHIRP / OpenGD77 /
  NeonPlug shorten the override when `shortenNames` is on — so preview can
  show a longer string than what actually gets written.
- **Radio-io org names (Web Serial) ignore build settings.**
  `applyListWireNameLimits(..., options: undefined)` always shortens, never
  abbreviates talk groups, and ignores the build's `shortenNames` /
  `maxNameLength` — even though the channel serial path does merge them via
  `mergeExportOptions`.
- **`assemble()` channel base ignores `nameModeOverride`** when there is no
  stored override, so the export/preview base can silently differ from what
  the operator picked in export settings until they pin something.

## Satellite transmitter encoded names (PR #1096)

**Storage:** `RadioBuild.satelliteOverrides` (`BuildEntityOverride[]`),
keyed by **transmitter** id, not spacecraft id.

**Generation entry points:**

| Symbol | Path | Notes |
| --- | --- | --- |
| `shortenSatelliteNames` | `src/core/domain/satellite/shortenSatelliteNames.ts` | Whole-set short names; produces `generatedShortName`, `suggestedFamiliar`, `suggestedOscar` |
| `resolveSatelliteTransmitterWriteNames` | `src/core/domain/satellite/resolveSatelliteTransmitterWriteNames.ts` | Per-transmitter resolve; calls the shortener **without** this row's override — pure |
| `packSatelliteWriteRecords` / `previewSatelliteWriteRecords` | `src/integrations/radio-io/radios/at-d890uv/satelliteCodec.ts` | Egress; consumes the same resolver |

**UI:** `BuildSatelliteKepsPage.tsx` nested spacecraft → transmitter table;
`SatelliteEncodedNameCell.tsx` (view + edit-icon toggle) and
`SatelliteWireNameOverrideInput.tsx` (inline editor: Familiar / OSCAR /
Reset).

This family is **already closer** to the intended pattern than the CPS
entity family: generation is pure, preview and pack share one resolver, and
the list view shows effective-only. Remaining gaps:

- **Suggestion click still commits immediately** (Familiar / OSCAR buttons
  apply and persist on click, same anti-pattern as `WireNameOverrideInput`).
  Reset is explicit and correct; Familiar/OSCAR should behave like Reset's
  sibling — fill the draft, require Save.
- **Dead code:** `resolveSatelliteWriteNames` (satellite-id-keyed) has no
  callers after the design moved to transmitter-keyed overrides — remove it.
- **Stale comment:** a comment on the shortener result says "shown as
  Default" — the UI shows Familiar/OSCAR, not a single Default; fix the
  comment.
- **Pre-/post-disambiguation ambiguity:** whole-set `~N` disambiguation can
  make the effective encoded name differ from the pre-`~N` suggestion shown;
  document (or resolve) whether the suggestion should reflect the
  disambiguated value.

## Do not conflate with Tools → Tracking

Tools → Tracking (pass grid, filters, observer/detail panels) has **no**
wire-name or override UI. Satellite wire-name editing lives on
**Build → Satellite keps**, not Tracking. Don't route future wire-name work
through the Tracking surface.
