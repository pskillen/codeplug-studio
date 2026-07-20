## Purpose

Operator workflow for reviewing and shaping CPS wire names before export. Each build entity type has a dedicated sub-route under `/builds/:id/*` with a **read-only list** (`WirePreviewDataTable`), a **per-row override modal** (`WirePreviewOverrideModal`), and (for channels) a **bulk-edit** surface for wire names and skip toggles.

**Tracking:** [#87](https://github.com/pskillen/codeplug-studio/issues/87) · UI rework [#349](https://github.com/pskillen/codeplug-studio/issues/349) · zone modal tabs [#472](https://github.com/pskillen/codeplug-studio/issues/472) · zones reorder preview [#468](https://github.com/pskillen/codeplug-studio/issues/468)

**Code:** `src/core/services/previewWireRows.ts`, `src/app/hooks/useBuildWirePreview.ts`, `src/app/routes/builds/wire-preview/`, `src/app/components/builds/wirePreview/`

## UI surfaces

| Surface       | Component / route                       | Edits                                                                                                                                                                            |
| ------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **List**      | `WirePreviewDataTable` on entity routes | Browse, search; **`reorderMode`** + order arrows when reorder config present; row click opens modal                                                                              |
| **Modal**     | `WirePreviewOverrideModal`              | Wire name, skip, force-include; zone rows use **Export / Members / Scan** tabs ([#472](https://github.com/pskillen/codeplug-studio/issues/472)); other kinds stay a single stack |
| **Bulk edit** | `/builds/:id/channels/bulk`             | Embedded `DataTable` — wire name + skip per channel; leave-page guard for unapplied drafts                                                                                       |

`BuildWirePreviewListPage` wraps list + modal for most entity routes. **Zones** and CHIRP flat memory use **`reorderMode`** with an order column for `orderOrSlot`. Zone preview rows are sorted with `sortZonesByExportOrder(..., zoneOverrides)` so the list matches export order after up/down. Zones whose build layout reorders **members** relative to the library show a **Custom member order** badge. Zone row modals use tabs: **Export** (common overrides), **Members** (member export order via `ZoneMemberOrderSection` — drag, selection Move, and **per-row arrows**), and **Scan** only when `zoneScanExportSupported` (trait: `ZoneGrouping` plus `ScanLists` or `DedicatedScanLists` — DM32/Anytone; not OpenGD77 `ZoneAsScanList`).

When build `orderOrSlot` (or zone member layout order) differs from the library default, an **`ExportOrderOverrideBanner`** appears with **Reset to library order** (confirmed via `window.confirm`, same seriousness as permanent Sort…). Reset clears densified `orderOrSlot` on the list, or writes zone member `channelIds` back to `resolveEffectiveZoneChannelIds`. This is **not** DataTable `storedOrder` “Return to export order” (display-only).

**Sort and filter** on list pages are client-side convenience only — they do **not** change export order. CHIRP memory order and zone `orderOrSlot` are updated only via up/down reorder controls (or library edits), not table sort. Reorder is disabled while search or “hide not included” filters are active on the zones page.

Build **contacts** wire preview debounces toolbar search (300 ms), matches **library name or callsign**, and shows a **Callsign** column for digital contacts. Large contact builds inherit shared [`DataTable`](../../src/app/components/ui/DataTable.md) virtual tbody rendering (`virtualize: 'auto'`, threshold 75 rows) for responsive scrolling.

## Override semantics

Build overrides use **sparse opt-out** storage (`BuildEntityOverride`):

| Field            | Meaning                                                                                                                                                                                                        |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _(no row)_       | Entity is **included**; wire name is generated from library fields                                                                                                                                             |
| `excluded: true` | Omit from export projection                                                                                                                                                                                    |
| `forceInclude`   | Zone overrides only — export standalone zone despite library `omitFromExport`                                                                                                                                  |
| `wireName`       | Override the generated CPS name                                                                                                                                                                                |
| `orderOrSlot`    | 1-based top-level export position (CHIRP memory `Location`; zone list order; gaps → blank slots on CHIRP). First reorder densifies `1…n`; **Reset to library order** clears all densified slots for that list. |

Overrides are stored on `FormatBuild` as `channelOverrides`, `zoneOverrides`, `talkGroupOverrides`, `contactOverrides`, and `rxGroupListOverrides` (`studioSchemaVersion: 3`).

## Preview rows

`previewWireRows(build, library, entityKind, options)` returns rows with:

- **displayLabel** — human-readable library label (may note multi-mode suffix)
- **displayDetails** — optional `{ label, value }` sub-lines under the display name (DM32 RX-list fan-out shows channel name and talk group id/slot)
- **generatedWireName** — `callsign` + `name` via `defaultChannelWireName` / `composeChannelWireName`; multi-mode channels append mode suffixes (`-F`, `-D`, `-Y`, `-DS`, …) when expansion applies
- **effectiveWireName** — override or generated
- **key** — stable override id (composite `${channelId}:${modeSuffix}` for multi-mode expansion rows; `${channelId}:${memberKey}` for DM32 RX-list fan-out)
- **expansionNote** — human-readable note when a row is synthesized (multi-mode suffix, RX-list fan-out, **Not linked to a zone**, **Not exported as its own zone** for library `omitFromExport`, or **Not referenced by exported channels**)

Wire preview pages and the export panel share **`useExportSettings`** (browser `localStorage`) for shortening, name mode, abbreviation toggles, and DM32 zone-derived scan export. Wire name overrides use a local draft with explicit **Apply** and **Revert** actions in the modal or bulk-edit table (avoids revision races from implicit debounced saves). Only **`/builds/:id/channels/bulk`** uses `useUnsavedNavigationGuard` for unapplied wire-name drafts.

Each entity wire page offers **Hide items not to be included in export** above the table when the library has rows for that entity kind (the toggle stays visible even when filtering hides every row). When enabled, rows are filtered with `isPreviewRowIncludedInExport` (respects per-row skip toggles and **Export inclusion** on `/builds/:id/export` for orphan channels, talk groups, and RX group lists). Zone rows with **Don't export as its own zone** in the library show a **Not exported as zone** badge; **Force export** and **Skip from export** are edited in the override modal (`forceInclude` / `excluded` on `zoneOverrides`). Precedence: `excluded` wins over `forceInclude`; `forceInclude` overrides library `omitFromExport`. Channel zone linkage uses library `Zone.members` plus build `zoneGrouping` layout — see [wire-name-composition.md](wire-name-composition.md#zone-membership-vs-wire-names). DM32 channel preview lists unlinked library channels (with zone note) so the toggle can reveal them when export inclusion excludes orphans. Contacts not referenced by exported channels are always omitted when the toggle is on.

### DM32 channel fan-out

For `formatId === 'dm32'`, channel preview uses the same expansion path as export for zoned/exported channels: `expandAllDm32ChannelsForExport` with `expandModes: false` and `expandRxGroupLists: true`. Channels linked to an RX group list with multiple talk-group members appear as one row per member. Fan-out rows include **displayDetails** (channel name, talk group name + digital ID + slot) so operators know what drives the generated wire name. Library channels omitted from export (when **Export channels not linked to a zone** is off) still appear in preview with a **Not linked to a zone** note. OpenGD77 builds continue to use multi-mode expansion only.

### Anytone m×n channel expansion

For `formatId === 'anytone'`, channel preview uses `expandAllAnytoneChannelsForExport` when **m×n channel expansion** is on in export settings (default on). Fan-out and scratch rows mirror export; **displayDetails** show talk-group context or a scratch marker. When expansion is off, preview matches lean export (one row per channel). See [export-projections.md](../import-export/anytone/export-projections.md).

### Anytone receive-bank preview

Anytone builds partition **AM airband** receive channels into `AMAir.CSV` / `AMZone.CSV` at export. Wire preview mirrors that split:

- **Channels** — DMR-bank channels only (no civil airband AM rows)
- **Zones** — zones with at least one non-airband member (DMR-only and dual-mode)
- **Airband** — airband channels plus zones with at least one airband member (airband-only and dual-mode)

Dual-mode zones appear on both **Zones** (DMR member projection) and **Airband** (AM member projection). See [am-air.md](../../reference/anytone/am-air.md) for export column detail.

## Routes

| Route                        | Entity kind        | Notes                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/builds/:id/channels`       | `channel`          | Read-only list + modal; export name mode + **Use abbreviations from library** on toolbar; link to bulk edit; multi-mode rows (OpenGD77), RX-list fan-out rows (DM32), or m×n expansion rows (Anytone when enabled). **Anytone:** airband channels appear on **Airband** only (not here). CHIRP delegates to flat memory page.                               |
| `/builds/:id/channels/bulk`  | `channel`          | Wire name + skip only per row; unsaved navigation guard for wire-name drafts. Shared by OpenGD77, DM32, Anytone DMR, and CHIRP.                                                                                                                                                                                                                             |
| `/builds/:id/airband`        | `channel` + `zone` | **Anytone only.** Embedded list + modal sections for AM airband channels and zones (`AMAir.CSV` / `AMZone.CSV`). Dual-mode zones also appear on **Zones** for the DMR projection.                                                                                                                                                                           |
| `/builds/:id/zones`          | `zone`             | List + modal with **Export / Members / Scan** tabs; **Not exported as zone** badge when library `omitFromExport` is set; force-export and skip on Export tab; member order on Members; zone-derived scan on Scan when trait-supported (`ZoneScanOverrideSection`). **Anytone:** airband-only zones appear on **Airband** only; dual-mode zones remain here. |
| `/builds/:id/talk-groups`    | `talkGroup`        | Unreferenced TGs still listed; overrides in modal                                                                                                                                                                                                                                                                                                           |
| `/builds/:id/contacts`       | `contact`          | Digital + analog contacts; overrides in modal                                                                                                                                                                                                                                                                                                               |
| `/builds/:id/rx-group-lists` | `rxGroupList`      | Overrides in modal                                                                                                                                                                                                                                                                                                                                          |

Secondary nav is trait-gated (`buildNavItems` in `src/app/routes/builds/nav.ts`).

## Related

- [wire-name-composition.md](wire-name-composition.md) — traits → fields for generated wire names
- [zone-grouping.md](zone-grouping.md) — build zone layout editor
- [name-shortening.md](../import-export/name-shortening.md) — abbreviation pipeline
- [WirePreviewDataTable sidecar](../../../src/app/components/builds/wirePreview/WirePreviewDataTable.md)
- [WirePreviewOverrideModal sidecar](../../../src/app/components/builds/wirePreview/WirePreviewOverrideModal.md)
- [data-model](../data-model/README.md) — `FormatBuild` overrides
