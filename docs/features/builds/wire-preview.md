## Purpose

Operator workflow for reviewing and shaping CPS wire names before export. Each build entity type has a dedicated sub-route under `/builds/:id/*` with a **wire preview list** (`WirePreviewDataTable`) whose Export name column edits **inline** (pencil → shared editor), a **per-row override modal** (`WirePreviewOverrideModal`) retained only for kinds with more than a name to edit (zones, CHIRP flat-memory scan inclusion), and (for channels) a **bulk-edit** surface for wire names and skip toggles.

**Tracking:** [#87](https://github.com/pskillen/codeplug-studio/issues/87) · UI rework [#349](https://github.com/pskillen/codeplug-studio/issues/349) · zone modal tabs [#472](https://github.com/pskillen/codeplug-studio/issues/472) · zones reorder preview [#468](https://github.com/pskillen/codeplug-studio/issues/468) · build Sort… / inclusion [#457](https://github.com/pskillen/codeplug-studio/issues/457) · bulk export-order reorder [#590](https://github.com/pskillen/codeplug-studio/issues/590) · select-by-attribute + Sort selection… [#719](https://github.com/pskillen/codeplug-studio/issues/719) · copy flat-memory order from another build [#739](https://github.com/pskillen/codeplug-studio/issues/739) · inline edit + remediation markers + Mode column [#1217](https://github.com/pskillen/codeplug-studio/issues/1217)

**Code:** `src/core/services/previewWireRows.ts`, `src/app/hooks/useBuildWirePreview.ts`, `src/app/routes/builds/wire-preview/`, `src/app/components/builds/wirePreview/`

## UI surfaces

| Surface           | Component / route                                              | Edits                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **List**          | `WirePreviewDataTable` (v2 `DataTable`) on entity routes       | Browse, search; **Export name** edits inline (pencil → [`WireNameInlineEditor`](../../../src/app/components/builds/wirePreview/WireNameInlineEditor.md)) with a [remediation marker](../../../src/app/components/builds/wirePreview/WireNameRemediationMarker.md); inline **Skip** / **Force export**; channel rows show a **Mode** column; **`reorderMode`** + drag/order column when reorder config present; **`bulkReorder`** (multi-select, drag, Move toolbar) on build Zones ([#590](https://github.com/pskillen/codeplug-studio/issues/590)); row click opens the modal only for kinds that still have one (zones) |
| **Settings card** | `BuildEntityExportSettingsCard`                                | Entity-scoped inclusion + naming (Channels / Talk groups / Contacts / RX group lists); Channels also host **Bulk edit names and skip…**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Modal**         | `WirePreviewOverrideModal` (`ModalShell` + v2 `OverrideField`) | Retained only where a row has **more than a name to edit** — zones (**Export / Members / Scan** tabs, [#472](https://github.com/pskillen/codeplug-studio/issues/472)) and CHIRP flat-memory channels (scan inclusion). Wire name uses the same shared inline editor as the list; Suggestion fills draft only (Save commits)                                                                                                                                                                                                                                                                                               |
| **Bulk edit**     | `/builds/:id/channels/bulk`                                    | Embedded `DataTable` — drafts accumulate locally; one page-level **Save** commits all wire names; skip toggles persist immediately; leave-page guard for unapplied drafts                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

`BuildWirePreviewListPage` wraps list + modal for most entity routes. Channel name cells show a **band pill** after the library label (from RX/TX). **Zones** and CHIRP flat memory use **`reorderMode`** with an order column for `orderOrSlot`. Zone preview rows are sorted with `sortZonesByExportOrder(..., zoneOverrides)` so the list matches export order after up/down. Zones whose build layout reorders **members** relative to the library show a **Custom member order** badge. One-shot **Sort zones…** / **Sort channels…** (build confirm copy) densifies `orderOrSlot` or member layout hints — library arrays are not rewritten. Zone row modals use tabs: **Export** (common overrides), **Members** (member export order via `ZoneMemberOrderSection` — drag, selection Move, per-row arrows, and Sort…; on MxN builds nests expanded export wires under each parent channel), and **Scan** only when `zoneScanExportSupported` (trait: `ZoneGrouping` plus `ScanLists` or `DedicatedScanLists` — DM32/Anytone; not OpenGD77 `ZoneAsScanList`). On MxN builds the Scan tab nests expanded projections under each parent channel; `scanMemberInclusion` keys may be the parent id or a projection `key`, and the cap badge uses expanded membership counts ([#570](https://github.com/pskillen/codeplug-studio/issues/570)).

When build `orderOrSlot` (or zone member layout order) differs from the library default, an **`ExportOrderOverrideBanner`** appears with **Reset to library order** (confirmed via `window.confirm`, same seriousness as permanent Sort…). Reset clears densified `orderOrSlot` on the list, or writes zone member `channelIds` back to `resolveEffectiveZoneChannelIds`. This is **not** DataTable `storedOrder` “Return to export order” (display-only).

**Column sort and filter** on list pages are client-side convenience only — they do **not** change export order. CHIRP memory order and zone `orderOrSlot` are updated via up/down reorder, drag (when **bulkReorder** is on), build **Sort…** / **Sort selection…**, or library edits — not table column sort. Reorder and Sort… are disabled while search or “hide not included” filters are active (zones page and flat-memory Channels).

**Flat-memory Channels** (CHIRP / NeonPlug UV-5R) add **Select…** helpers ([`ExportOrderSelectMenu`](../../../src/app/components/builds/wirePreview/ExportOrderSelectMenu.md)) to toggle-select by band, FM/AM mode, or simplex/split before dragging a block or running **Sort selection…**. **Sort selection…** collates a split multi-select at the earliest selected index, sorts only that block, and leaves unselected relative order outside the block unchanged ([#719](https://github.com/pskillen/codeplug-studio/issues/719)). **Copy order from…** (label provisional) copies memory location order from another same-project `FlatMemoryList` build: channels match by library UUID; matched channels follow the source sequence; unmatched channels on this build append in their prior relative order; order densifies to contiguous `1…n` via `orderOrSlot` ([#739](https://github.com/pskillen/codeplug-studio/issues/739)). See [`CopyOrderFromBuildMenu`](../../../src/app/components/builds/wirePreview/CopyOrderFromBuildMenu.md).

List **Skip / Force** column: **Skip from export** for most rows; zones with library **Don't export as its own zone** show **Force export** only (red when on). Turn force off to honour the library omit.

Build **contacts** wire preview debounces toolbar search (300 ms), matches **library name or callsign**, and shows a **Callsign** column for digital contacts. Large contact builds inherit shared [`DataTable`](../../src/app/components/v2/DataTable.md) virtual tbody rendering (`virtualize: 'auto'`, threshold 75 rows) for responsive scrolling.

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

`previewWireRows(build, library, entityKind, anytoneBank)` returns rows with:

- **displayLabel** — human-readable library label (may note multi-mode suffix)
- **displayDetails** — optional `{ label, value }` sub-lines under the display name (DM32 RX-list fan-out shows channel name and talk group id/slot)
- **generatedWireName** — pure suggestion from library fields + export settings only (never this row's own override)
- **effectiveWireName** — override or generated
- **remediation** — what (if anything) fitting the effective name to the profile limit required (`none` / `shortened` / `disambiguated` / `truncated` / `over_limit`); undefined for expansion rows that don't join a resolver result. Drives the list's read-state marker — see table below
- **channelMode** — channel rows only; which mode this row represents (m×n site fan-out / multi-mode expansion use the row's own projected mode, single-mode rows use the channel's mode profile) — feeds the **Mode** column
- **key** — stable override id (composite `${channelId}:${modeSuffix}` for multi-mode expansion rows; `${channelId}:${memberKey}` for DM32 RX-list fan-out)
- **expansionNote** — human-readable note when a row is synthesized (multi-mode suffix, RX-list fan-out, **Not linked to a zone**, **Not exported as its own zone** for library `omitFromExport`, or **Not referenced by exported channels**)

Zones, scan lists, talk groups, contacts, and RX group lists — entity kinds with no
expansion concept — resolve through the shared **`resolveWireNames`** service
(`src/core/services/resolveWireNames.ts`), so preview reads the same build export
settings (name style, shorten, abbreviation) and profile name-length limit
(`getProfileExportLimits`) that export will use for those rows, including for build
overrides (now hard-truncated to the profile limit instead of shown raw). Channel rows
with an m×n or multi-mode expansion (or CHIRP flat-memory rows) still compute their base
name through the existing expansion pipelines (`expandAllMxNChannels`,
`expandChannelWireRows`) rather than the resolver — those composition hooks are a later
phase; their overrides are shown unshortened until then. Full egress convergence
(serialisers and Web Serial reading the same resolver) is a later phase too.

Wire preview pages and the export panel share the same **`build.exportSettings`** row (shortening, name mode, abbreviation toggles, zone-derived scan export) via [`ExportBuildSettingsSections`](../../../src/app/components/builds/ExportBuildSettingsSections.md) / [`ExportNameSettingsFields`](../../../src/app/components/builds/ExportNameSettingsFields.md) and the entity-scoped [`BuildEntityExportSettingsCard`](../../../src/app/components/builds/BuildEntityExportSettingsCard.md) mirror. Browser `localStorage` is no longer the live store — see [name-shortening.md — Operator settings](../import-export/name-shortening.md#operator-settings) for the one-time legacy migration. Wire name overrides use a local draft with explicit **Save** and **Revert** — inline on the list (pencil swaps the cell in place) and in the modal for the kinds that still have one; suggestion clicks fill the draft only. The channel **bulk-edit** table accumulates drafts locally and commits them with one page-level **Save** (no per-row Save). Only **`/builds/:id/channels/bulk`** uses `useUnsavedNavigationGuard` for unapplied wire-name drafts.

### Remediation marker (read state)

The list's Export name column shows a severity marker driven by `remediation`, not a blanket
truncation flag — clean shortening/disambiguation stays quiet, only genuine information loss
gets the orange triangle:

| `remediation`   | Marker          | Meaning                                                               |
| --------------- | --------------- | --------------------------------------------------------------------- |
| `none`          | none            | Effective name equals the library name (or fits without change)       |
| `shortened`     | dimmed `≈`      | Dictionary/abbreviation shortening fit the name within the limit      |
| `disambiguated` | dimmed `≈`      | Another row claimed this name; export uses the disambiguated variant  |
| `truncated`     | orange triangle | An override was hard-cut to fit the limit                             |
| `over_limit`    | orange triangle | Still longer than the limit after remediation — the radio will cut it |

Satellite keps has no resolver `remediation` (fixed-width radio name field, its own shortener) —
`src/app/lib/satelliteWireNameRemediation.ts` approximates the same table from the existing
`nameTruncated` flag: a result under the write budget was shortened cleanly, one that fills the
whole budget was cut.

### Suggestion rule

One row offers **one suggestion per identity**, with one explicit exception: a **channel**
row's inline editor offers one suggestion per `ChannelExportNameMode` (Callsign + name /
Callsign only / Name only / Callsign suffix + name), each run through the same limit/shorten
pipeline as the build-default suggestion — reusing the per-style composition
`ChannelWireNameExamples.tsx` already computes on the channel edit page
(`channelWireNamePreviewExamples`). Every other entity kind — zones, talk groups, contacts,
scan lists, RX group lists, and the channel **bulk-edit** table — keeps exactly one suggestion.
Satellite keps' Familiar / OSCAR pair is the other legitimate multi-suggestion case: two
different source identities for one spacecraft, not two renderings of one name. Clicking any
suggestion always **only fills the draft** — it never commits, and for the channel style
suggestions it never changes the build's stored Name style setting.

Each entity wire page offers **Hide items not to be included in export** above the table when the library has rows for that entity kind (the toggle stays visible even when filtering hides every row). When enabled, rows are filtered with `isPreviewRowIncludedInExport` (respects per-row skip toggles and **Export inclusion** on `/builds/:id/export` for orphan channels, talk groups, and RX group lists). Zone rows with **Don't export as its own zone** in the library show a **Not exported as zone** badge; **Force export** is edited on the list and in the override modal (`forceInclude` on `zoneOverrides`) — no separate Skip for those rows (turn force off to honour the library omit). For other entities, **Skip from export** uses `excluded`. Precedence when both flags exist: `excluded` wins over `forceInclude`; `forceInclude` overrides library `omitFromExport`. Channel zone linkage uses library `Zone.members` plus build `zoneGrouping` layout — see [wire-name-composition.md](wire-name-composition.md#zone-membership-vs-wire-names). DM32 channel preview lists unlinked library channels (with zone note) so the toggle can reveal them when export inclusion excludes orphans. Contacts not referenced by exported channels are always omitted when the toggle is on.

### Resolution view

**Tracking:** [#1219](https://github.com/pskillen/codeplug-studio/issues/1219), closes [#956](https://github.com/pskillen/codeplug-studio/issues/956) — absorbs the deleted `/builds/:id/export-resolution` About page's two readings.

- **Per row, "why is it this?"** — a **Resolution** section lists each exported field next to
  the layer that decided its effective value. Channel rows: wire name, transmit, TX permit,
  talker alias (DMR profiles), analog squelch (analog profiles). Zone rows: wire name, plus a
  member-by-member **zone-derived scan membership** list when the zone is set to export as a
  scan list and the format/profile supports the trait. Shown in the channel inline editor
  (expanded while editing) and in the zone/CHIRP override modal, below the wire-name editor —
  see [`WireResolutionSection`](../../../src/app/components/builds/wirePreview/WireResolutionSection.md).
- **Across rows, "show me the whole matrix"** — optional **resolution columns** on the
  channels and zones list (Transmit / TX permit / Talker alias / Analog squelch for channels;
  a Zone-derived scan include/skip count for zones). Hideable, off by default, same
  column-visibility picker as the existing **Details** column.

Both readings reuse the existing `resolve*WithLayer` cascades unchanged
(`@core/import-export/channelBehaviourDefaults/resolve.ts`,
`@core/import-export/zoneBehaviourDefaults/resolve.ts`) via
`src/app/lib/wirePreviewResolution.ts`. **Wire-name layer attribution** is not a stored
layer — it is derived from `WirePreviewRow.hasWireNameOverride` / `.remediation`: a row
override wins outright ("Row override"); otherwise a non-`none` remediation means the
profile's naming constraint (length limit or dedupe) changed the composed name ("Target
constraint"); absent both, the value is exactly what library data + build naming settings
composed ("Library + build settings"). See `wireNameResolutionLayer` /
`wireNameLayerLabel` in `src/app/lib/behaviourResolutionLabels.ts`.

### m×n channel fan-out (MxNChannelExpansion)

When `hasMxNChannelExpansion(build.radioTargetId)` is true (Baofeng DM-32UV — CPS, NeonPlug, and Web Serial egresses — and Anytone AT-D890UV), channel preview uses the shared **`expandAllMxNChannels`** API (same projection as CPS export and Web Serial write). Fan-out and scratch rows honour Export settings (`expandRxGroupLists`, `exportScratchChannels`). Fan-out rows include **displayDetails** (channel name, talk group name + digital ID + slot, or a scratch marker). Library channels omitted from export (when **Export channels not linked to a zone** is off) still appear in preview with a **Not linked to a zone** note. Anytone site wire names still go through `anytoneChannelWireName` as a resolve hook. OpenGD77 builds continue to use multi-mode expansion only.

On the **Channels** list, when a library channel expands to **more than one** projection (m×n, multi-mode, or scratch companions), rows **nest under a shaded parent** with a projection-count badge and chevron collapse ([#560](https://github.com/pskillen/codeplug-studio/issues/560)). Parent **Skip** excludes the library channel id (all projections); child **Skip** and wire-name overrides use the projection `key` ([#351](https://github.com/pskillen/codeplug-studio/issues/351)). Single-projection channels stay flat. Nesting is presentation-only over flat `previewWireRows` — not a second expansion pipeline.

See [export-projections.md](../import-export/anytone/export-projections.md) and [multi-talkgroup-expansion.md](../../reference/multi-talkgroup-expansion.md).

### AT-D890UV receive-bank preview (D890-only)

**AT-D890UV only** — not a generic build trait. Secondary nav and bank split apply when the active egress is `anytone-at-d890uv` (Anytone CSV) **or** `radio-io-at-d890uv` (Web Serial), gated by `usesAtD890AirbandBankSplit` — not bare `formatId === 'anytone'` and not “library has AM channels”. Other Anytone models (e.g. D878UVII) must not inherit this chrome.

The parallel **AM airband** bank partitions receive-only civil airband channels and zones away from the DMR/MR bank at export and Web Serial Write. Wire preview mirrors that split on **both** pathways:

- **Channels** — DMR-bank channels only (no civil airband AM rows)
- **Zones** — zones with at least one non-airband member (DMR-only and dual-mode); airband-only zones **never** appear here
- **AM airband** (`/builds/:id/airband`) — positive review surface for AM channels + AM zones (CSV `AMAir.CSV` / `AMZone.CSV` or serial `AmAir*` / `AmZone*` banks); pathway-aware copy and serial Write warnings ([#824](https://github.com/pskillen/codeplug-studio/issues/824))

Dual-mode zones appear on both **Zones** (DMR member projection) and **AM airband** (AM member projection). **Zone-derived scan** (`exportScanList`, scan carriers) is a **DMR-bank** feature only — not AmZoneScan on the radio. Airband-only zones hide Export scan list controls on the Zones page ([#823](https://github.com/pskillen/codeplug-studio/issues/823)). See [am-air.md](../../reference/export-formats/anytone/am-air.md) for CSV column detail and [AT-D890UV Write contract](../../reference/radios/anytone/at-d890uv/README.md) for serial banks.

## Routes

| Route                        | Entity kind        | Notes                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/builds/:id/channels`       | `channel`          | Read-only list + modal; export name mode + **Use abbreviations from library** on toolbar; link to bulk edit; multi-mode rows (OpenGD77), RX-list fan-out rows (DM32), or m×n expansion rows (Anytone when enabled). **Anytone:** airband channels appear on **Airband** only (not here). Flat-memory profiles (`FlatMemoryList`) use the shared flat-memory Channels page.                  |
| `/builds/:id/scan-list`      | —                  | Flat-memory + per-channel scan flag only — build-wide default scan + per-memory Skip / Default / Always scan stored on `channelOverrides.scanInclusion` (not library). No reorder or wire names.                                                                                                                                                                                            |
| `/builds/:id/channels/bulk`  | `channel`          | Wire-name drafts + page-level **Save**; skip toggles immediate; unsaved navigation guard for pending drafts. Shared by OpenGD77, DM32, Anytone DMR, and CHIRP.                                                                                                                                                                                                                              |
| `/builds/:id/airband`        | `channel` + `zone` | **AT-D890UV only** (`anytone-at-d890uv` or `radio-io-at-d890uv` active egress). Embedded lists for AM airband channels and zones — CSV files or serial `AmAir*` / `AmZone*` banks ([#824](https://github.com/pskillen/codeplug-studio/issues/824)). Dual-mode zones also appear on **Zones** for the DMR projection.                                                                        |
| `/builds/:id/zones`          | `zone`             | List + modal with **Export / Members / Scan** tabs; **Not exported as zone** badge when library `omitFromExport` is set; force-export and skip on Export tab; member order on Members; zone-derived scan on Scan when trait-supported (`ZoneScanOverrideSection`) — **D890:** hidden for airband-only zones; airband-only zones appear on **AM airband** only; dual-mode zones remain here. |
| `/builds/:id/talk-groups`    | `talkGroup`        | Unreferenced TGs still listed; overrides in modal                                                                                                                                                                                                                                                                                                                                           |
| `/builds/:id/contacts`       | `contact`          | Digital + analog contacts; overrides in modal                                                                                                                                                                                                                                                                                                                                               |
| `/builds/:id/rx-group-lists` | `rxGroupList`      | Overrides in modal                                                                                                                                                                                                                                                                                                                                                                          |

Secondary nav is trait-gated from `radioTargetId`. **AM airband** keys off the active D890 egress (`anytone-at-d890uv` or `radio-io-at-d890uv`) — not a build capability trait. NeonPlug settings / Radio image appear when the matching retain bag exists on any egress (`buildNavItems` in `src/app/routes/builds/nav.ts`) — not only while that pathway is selected ([#668](https://github.com/pskillen/codeplug-studio/issues/668)).

## Related

- [wire-name-composition.md](wire-name-composition.md) — traits → fields for generated wire names
- [zone-grouping.md](zone-grouping.md) — build zone layout editor
- [name-shortening.md](../import-export/name-shortening.md) — abbreviation pipeline
- [WirePreviewDataTable sidecar](../../../src/app/components/builds/wirePreview/WirePreviewDataTable.md)
- [WireNameInlineEditor sidecar](../../../src/app/components/builds/wirePreview/WireNameInlineEditor.md)
- [WireNameRemediationMarker sidecar](../../../src/app/components/builds/wirePreview/WireNameRemediationMarker.md)
- [WirePreviewExportNameCell sidecar](../../../src/app/components/builds/wirePreview/WirePreviewExportNameCell.md)
- [WirePreviewBulkEditTable sidecar](../../../src/app/components/builds/wirePreview/WirePreviewBulkEditTable.md)
- [WirePreviewInclusionCell sidecar](../../../src/app/components/builds/wirePreview/WirePreviewInclusionCell.md)
- [BuildEntityExportSettingsCard sidecar](../../../src/app/components/builds/BuildEntityExportSettingsCard.md)
- [WirePreviewOverrideModal sidecar](../../../src/app/components/builds/wirePreview/WirePreviewOverrideModal.md)
- [WireResolutionSection sidecar](../../../src/app/components/builds/wirePreview/WireResolutionSection.md)
- [ChirpChannelScanSection sidecar](../../../src/app/components/builds/wirePreview/overrideModalSections/ChirpChannelScanSection.md)
- [data-model](../data-model/README.md) — `RadioBuild` overrides
