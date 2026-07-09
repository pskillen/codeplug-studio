## Purpose

Operator workflow for reviewing and shaping CPS wire names before export. Each build entity type has a dedicated sub-route under `/builds/:id/*` with a shared `WirePreviewTable`.

**Tracking:** [#87](https://github.com/pskillen/codeplug-studio/issues/87)

**Code:** `src/core/services/previewWireRows.ts`, `src/app/hooks/useBuildWirePreview.ts`, `src/app/routes/builds/wire-preview/`

## Override semantics

Build overrides use **sparse opt-out** storage (`BuildEntityOverride`):

| Field            | Meaning                                                                         |
| ---------------- | ------------------------------------------------------------------------------- |
| _(no row)_       | Entity is **included**; wire name is generated from library fields              |
| `excluded: true` | Omit from export projection                                                     |
| `forceInclude`   | Zone overrides only — export standalone zone despite library `omitFromExport`   |
| `wireName`       | Override the generated CPS name                                                 |
| `orderOrSlot`    | 1-based top-level export position (CHIRP memory `Location`; gaps → blank slots) |

Overrides are stored on `FormatBuild` as `channelOverrides`, `zoneOverrides`, `talkGroupOverrides`, `contactOverrides`, and `rxGroupListOverrides` (`studioSchemaVersion: 3`).

## Preview rows

`previewWireRows(build, library, entityKind, options)` returns rows with:

- **displayLabel** — human-readable library label (may note multi-mode suffix)
- **displayDetails** — optional `{ label, value }` sub-lines under the display name (DM32 RX-list fan-out shows channel name and talk group id/slot)
- **generatedWireName** — `callsign` + `name` via `defaultChannelWireName` / `composeChannelWireName`; multi-mode channels append mode suffixes (`-F`, `-D`, `-Y`, `-DS`, …) when expansion applies
- **effectiveWireName** — override or generated
- **key** — stable override id (composite `${channelId}:${modeSuffix}` for multi-mode expansion rows; `${channelId}:${memberKey}` for DM32 RX-list fan-out)
- **expansionNote** — human-readable note when a row is synthesized (multi-mode suffix, RX-list fan-out, **Not linked to a zone**, **Not exported as its own zone** for library `omitFromExport`, or **Not referenced by exported channels**)

Wire preview pages and the export panel share **`useExportSettings`** (browser `localStorage`) for shortening, name mode, abbreviation toggles, and DM32 zone-derived scan export. Wire name overrides use a local draft with explicit **Apply** and **Revert** actions before persisting (avoids revision races from implicit debounced saves). Navigating away with unapplied drafts opens a confirmation dialog (`useUnsavedNavigationGuard`).

Each entity wire page offers **Hide items not to be included in export** above the table when the library has rows for that entity kind (the toggle stays visible even when filtering hides every row). When enabled, rows are filtered with `isPreviewRowIncludedInExport` (respects per-row skip toggles and **Export inclusion** on `/builds/:id/export` for orphan channels, talk groups, and RX group lists). Zone rows with **Don't export as its own zone** in the library show a **Not exported as zone** badge and a **Force export** switch (per-build `forceInclude` on `zoneOverrides`); when force export is on, an additional **Skip from export** toggle allows build-level exclusion. Other entity rows use a **Skip from export** toggle (`excluded: true` on the matching `*Overrides` array). Precedence: `excluded` wins over `forceInclude`; `forceInclude` overrides library `omitFromExport`. Channel zone linkage uses library `Zone.members` plus build `zoneGrouping` layout — see [wire-name-composition.md](wire-name-composition.md#zone-membership-vs-wire-names). DM32 channel preview lists unlinked library channels (with zone note) so the toggle can reveal them when export inclusion excludes orphans. Contacts not referenced by exported channels are always omitted when the toggle is on.

### DM32 channel fan-out

For `formatId === 'dm32'`, channel preview uses the same expansion path as export for zoned/exported channels: `expandAllDm32ChannelsForExport` with `expandModes: false` and `expandRxGroupLists: true`. Channels linked to an RX group list with multiple talk-group members appear as one row per member. Fan-out rows include **displayDetails** (channel name, talk group name + digital ID + slot) so operators know what drives the generated wire name. Library channels omitted from export (when **Export channels not linked to a zone** is off) still appear in preview with a **Not linked to a zone** note. OpenGD77 builds continue to use multi-mode expansion only.

### Anytone receive-bank preview

Anytone builds partition **AM airband** receive channels into `AMAir.CSV` / `AMZone.CSV` at export. Wire preview mirrors that split:

- **Channels** — DMR-bank channels only (no civil airband AM rows)
- **Zones** — zones with at least one non-airband member (DMR-only and dual-mode)
- **Airband** — airband channels plus zones with at least one airband member (airband-only and dual-mode)

Dual-mode zones appear on both **Zones** (DMR member projection) and **Airband** (AM member projection). See [am-air.md](../../reference/anytone/am-air.md) for export column detail.

## Routes

| Route                        | Entity kind        | Notes                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/builds/:id/channels`       | `channel`          | Export name mode + **Use abbreviations from library** toggle; click default name to store override; multi-mode rows (OpenGD77) or RX-list fan-out rows (DM32); leave-page guard for unapplied drafts. **Anytone:** airband channels appear on **Airband** only (not here).                                                                                          |
| `/builds/:id/airband`        | `channel` + `zone` | **Anytone only.** AM airband receive channels and zones that export to `AMAir.CSV` / `AMZone.CSV`. Dual-mode zones (DMR + airband members) also appear on **Zones** for the DMR projection.                                                                                                                                                                         |
| `/builds/:id/zones`          | `zone`             | Click default name to store override; **Not exported as zone** badge when library `omitFromExport` is set; **Force export** per-build override; **N channels** / **M zones** member pills with name tooltips; DM32 builds show zone export trait controls above the table. **Anytone:** airband-only zones appear on **Airband** only; dual-mode zones remain here. |
| `/builds/:id/talk-groups`    | `talkGroup`        | Unreferenced TGs still listed; click default name to store override                                                                                                                                                                                                                                                                                                 |
| `/builds/:id/contacts`       | `contact`          | Digital + analog contacts; click default name to store override                                                                                                                                                                                                                                                                                                     |
| `/builds/:id/rx-group-lists` | `rxGroupList`      | Click default name to store override                                                                                                                                                                                                                                                                                                                                |

Secondary nav is trait-gated (`buildNavItems` in `src/app/routes/builds/nav.ts`).

## Related

- [wire-name-composition.md](wire-name-composition.md) — traits → fields for generated wire names
- [zone-grouping.md](zone-grouping.md) — build zone layout editor
- [name-shortening.md](../import-export/name-shortening.md) — abbreviation pipeline
- [WirePreviewTable sidecar](../../../src/app/components/builds/WirePreviewTable.md)
- [data-model](../data-model/README.md) — `FormatBuild` overrides
