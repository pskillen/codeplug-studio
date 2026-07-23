## Purpose

Operator workflow for reviewing and shaping CPS wire names before export. Each build entity type has a dedicated sub-route under `/builds/:id/*` with a **read-only list** (`WirePreviewDataTable`), a **per-row override modal** (`WirePreviewOverrideModal`), and (for channels) a **bulk-edit** surface for wire names and skip toggles.

**Tracking:** [#87](https://github.com/pskillen/codeplug-studio/issues/87) · UI rework [#349](https://github.com/pskillen/codeplug-studio/issues/349) · zone modal tabs [#472](https://github.com/pskillen/codeplug-studio/issues/472) · zones reorder preview [#468](https://github.com/pskillen/codeplug-studio/issues/468) · build Sort… / inclusion [#457](https://github.com/pskillen/codeplug-studio/issues/457)

**Code:** `src/core/services/previewWireRows.ts`, `src/app/hooks/useBuildWirePreview.ts`, `src/app/routes/builds/wire-preview/`, `src/app/components/builds/wirePreview/`

## UI surfaces

| Surface           | Component / route                       | Edits                                                                                                                                                                            |
| ----------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **List**          | `WirePreviewDataTable` on entity routes | Browse, search; inline **Skip** / **Force export**; **`reorderMode`** + order arrows when reorder config present; row click opens modal                                          |
| **Settings card** | `BuildEntityExportSettingsCard`         | Entity-scoped inclusion + naming (Channels / Talk groups / Contacts / RX group lists); Channels also host **Bulk edit names and skip…**                                          |
| **Modal**         | `WirePreviewOverrideModal`              | Wire name, skip, force-include; zone rows use **Export / Members / Scan** tabs ([#472](https://github.com/pskillen/codeplug-studio/issues/472)); other kinds stay a single stack |
| **Bulk edit**     | `/builds/:id/channels/bulk`             | Embedded `DataTable` — wire name + skip per channel; leave-page guard for unapplied drafts                                                                                       |

`BuildWirePreviewListPage` wraps list + modal for most entity routes. Channel name cells show a **band pill** after the library label (from RX/TX). **Zones** and CHIRP flat memory use **`reorderMode`** with an order column for `orderOrSlot`. Zone preview rows are sorted with `sortZonesByExportOrder(..., zoneOverrides)` so the list matches export order after up/down. Zones whose build layout reorders **members** relative to the library show a **Custom member order** badge. One-shot **Sort zones…** / **Sort channels…** (build confirm copy) densifies `orderOrSlot` or member layout hints — library arrays are not rewritten. Zone row modals use tabs: **Export** (common overrides), **Members** (member export order via `ZoneMemberOrderSection` — drag, selection Move, per-row arrows, and Sort…), and **Scan** only when `zoneScanExportSupported` (trait: `ZoneGrouping` plus `ScanLists` or `DedicatedScanLists` — DM32/Anytone; not OpenGD77 `ZoneAsScanList`).

When build `orderOrSlot` (or zone member layout order) differs from the library default, an **`ExportOrderOverrideBanner`** appears with **Reset to library order** (confirmed via `window.confirm`, same seriousness as permanent Sort…). Reset clears densified `orderOrSlot` on the list, or writes zone member `channelIds` back to `resolveEffectiveZoneChannelIds`. This is **not** DataTable `storedOrder` “Return to export order” (display-only).

**Column sort and filter** on list pages are client-side convenience only — they do **not** change export order. CHIRP memory order and zone `orderOrSlot` are updated via up/down reorder, build **Sort…**, or library edits — not table column sort. Reorder and Sort… are disabled while search or “hide not included” filters are active on the zones page.

List **Skip / Force** column: **Skip from export** for most rows; zones with library **Don't export as its own zone** show **Force export** only (red when on). Turn force off to honour the library omit.

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
| `scanInclusion`  | Flat-memory / per-channel scan flag only — build-scoped Skip / Default / Always scan; wins over library `Channel.scanInclusion` at export ([#589](https://github.com/pskillen/codeplug-studio/issues/589)).    |

Overrides are stored on `RadioBuild` as `channelOverrides`, `zoneOverrides`, `talkGroupOverrides`, `contactOverrides`, and `rxGroupListOverrides`.

## Preview rows

`previewWireRows(build, library, entityKind, options)` returns rows with:

- **displayLabel** — human-readable library label (may note multi-mode suffix)
- **displayDetails** — optional `{ label, value }` sub-lines under the display name (DM32 RX-list fan-out shows channel name and talk group id/slot)
- **generatedWireName** — `callsign` + `name` via `defaultChannelWireName` / `composeChannelWireName`; multi-mode channels append mode suffixes (`-F`, `-D`, `-Y`, `-DS`, …) when expansion applies
- **effectiveWireName** — override or generated
- **key** — stable override id (composite `${channelId}:${modeSuffix}` for multi-mode expansion rows; `${channelId}:${memberKey}` for DM32 RX-list fan-out)
- **expansionNote** — human-readable note when a row is synthesized (multi-mode suffix, RX-list fan-out, **Not linked to a zone**, **Not exported as its own zone** for library `omitFromExport`, or **Not referenced by exported channels**)

Wire preview pages and the export panel share **`useExportSettings`** (browser `localStorage`) for shortening, name mode, abbreviation toggles, and DM32 zone-derived scan export. Wire name overrides use a local draft with explicit **Apply** and **Revert** actions in the modal or bulk-edit table (avoids revision races from implicit debounced saves). Only **`/builds/:id/channels/bulk`** uses `useUnsavedNavigationGuard` for unapplied wire-name drafts.

Each entity wire page offers **Hide items not to be included in export** above the table when the library has rows for that entity kind (the toggle stays visible even when filtering hides every row). When enabled, rows are filtered with `isPreviewRowIncludedInExport` (respects per-row skip toggles and **Export inclusion** on `/builds/:id/export` for orphan channels, talk groups, and RX group lists). Zone rows with **Don't export as its own zone** in the library show a **Not exported as zone** badge; **Force export** is edited on the list and in the override modal (`forceInclude` on `zoneOverrides`) — no separate Skip for those rows (turn force off to honour the library omit). For other entities, **Skip from export** uses `excluded`. Precedence when both flags exist: `excluded` wins over `forceInclude`; `forceInclude` overrides library `omitFromExport`. Channel zone linkage uses library `Zone.members` plus build `zoneGrouping` layout — see [wire-name-composition.md](wire-name-composition.md#zone-membership-vs-wire-names). DM32 channel preview lists unlinked library channels (with zone note) so the toggle can reveal them when export inclusion excludes orphans. Contacts not referenced by exported channels are always omitted when the toggle is on.

### m×n channel fan-out (MxNChannelExpansion)

When `hasMxNChannelExpansion(build.radioTargetId)` is true (Baofeng DM-32UV — CPS, NeonPlug, and Web Serial egresses — and Anytone AT-D890UV), channel preview uses the shared **`expandAllMxNChannels`** API (same projection as CPS export and Web Serial write). Fan-out and scratch rows honour Export settings (`expandRxGroupLists`, `exportScratchChannels`). Fan-out rows include **displayDetails** (channel name, talk group name + digital ID + slot, or a scratch marker). Library channels omitted from export (when **Export channels not linked to a zone** is off) still appear in preview with a **Not linked to a zone** note. Anytone site wire names still go through `anytoneChannelWireName` as a resolve hook. OpenGD77 builds continue to use multi-mode expansion only.

On the **Channels** list, when a library channel expands to **more than one** projection (m×n, multi-mode, or scratch companions), rows **nest under a shaded parent** with a projection-count badge and chevron collapse ([#560](https://github.com/pskillen/codeplug-studio/issues/560)). Parent **Skip** excludes the library channel id (all projections); child **Skip** and wire-name overrides use the projection `key` ([#351](https://github.com/pskillen/codeplug-studio/issues/351)). Single-projection channels stay flat. Nesting is presentation-only over flat `previewWireRows` — not a second expansion pipeline.

See [export-projections.md](../import-export/anytone/export-projections.md) and [multi-talkgroup-expansion.md](../../reference/multi-talkgroup-expansion.md).

### Anytone receive-bank preview

Anytone builds partition **AM airband** receive channels into `AMAir.CSV` / `AMZone.CSV` at export. Wire preview mirrors that split:

- **Channels** — DMR-bank channels only (no civil airband AM rows)
- **Zones** — zones with at least one non-airband member (DMR-only and dual-mode)
- **Airband** — airband channels plus zones with at least one airband member (airband-only and dual-mode)

Dual-mode zones appear on both **Zones** (DMR member projection) and **Airband** (AM member projection). See [am-air.md](../../reference/export-formats/anytone/am-air.md) for export column detail.

## Routes

| Route                        | Entity kind        | Notes                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/builds/:id/channels`       | `channel`          | Read-only list + modal; export name mode + **Use abbreviations from library** on toolbar; link to bulk edit; multi-mode rows (OpenGD77), RX-list fan-out rows (DM32), or m×n expansion rows (Anytone when enabled). **Anytone:** airband channels appear on **Airband** only (not here). Flat-memory profiles (`FlatMemoryList`) use the shared flat-memory Channels page. |
| `/builds/:id/scan-list`      | —                  | Flat-memory + per-channel scan flag only — build-wide default scan + per-memory Skip / Default / Always scan stored on `channelOverrides.scanInclusion` (not library). No reorder or wire names.                                                                                                                                                                           |
| `/builds/:id/channels/bulk`  | `channel`          | Wire name + skip only per row; unsaved navigation guard for wire-name drafts. Shared by OpenGD77, DM32, Anytone DMR, and CHIRP.                                                                                                                                                                                                                                            |
| `/builds/:id/airband`        | `channel` + `zone` | **Anytone only.** Embedded list + modal sections for AM airband channels and zones (`AMAir.CSV` / `AMZone.CSV`). Dual-mode zones also appear on **Zones** for the DMR projection.                                                                                                                                                                                          |
| `/builds/:id/zones`          | `zone`             | List + modal with **Export / Members / Scan** tabs; **Not exported as zone** badge when library `omitFromExport` is set; force-export and skip on Export tab; member order on Members; zone-derived scan on Scan when trait-supported (`ZoneScanOverrideSection`). **Anytone:** airband-only zones appear on **Airband** only; dual-mode zones remain here.                |
| `/builds/:id/talk-groups`    | `talkGroup`        | Unreferenced TGs still listed; overrides in modal                                                                                                                                                                                                                                                                                                                          |
| `/builds/:id/contacts`       | `contact`          | Digital + analog contacts; overrides in modal                                                                                                                                                                                                                                                                                                                              |
| `/builds/:id/rx-group-lists` | `rxGroupList`      | Overrides in modal                                                                                                                                                                                                                                                                                                                                                         |

Secondary nav is trait-gated from `radioTargetId`, with NeonPlug settings / Radio image / Airband shown only when the **active egress** matches (`buildNavItems` in `src/app/routes/builds/nav.ts`).

## Related

- [wire-name-composition.md](wire-name-composition.md) — traits → fields for generated wire names
- [zone-grouping.md](zone-grouping.md) — build zone layout editor
- [name-shortening.md](../import-export/name-shortening.md) — abbreviation pipeline
- [WirePreviewDataTable sidecar](../../../src/app/components/builds/wirePreview/WirePreviewDataTable.md)
- [WirePreviewInclusionCell sidecar](../../../src/app/components/builds/wirePreview/WirePreviewInclusionCell.md)
- [BuildEntityExportSettingsCard sidecar](../../../src/app/components/builds/BuildEntityExportSettingsCard.md)
- [WirePreviewOverrideModal sidecar](../../../src/app/components/builds/wirePreview/WirePreviewOverrideModal.md)
- [ChirpChannelScanSection sidecar](../../../src/app/components/builds/wirePreview/overrideModalSections/ChirpChannelScanSection.md)
- [data-model](../data-model/README.md) — `RadioBuild` overrides
