## Purpose

Wire preview list for build entity routes. Shows library label, effective wire name (override or generated), a remediation severity marker, and export-status badges. The **Export name** column edits inline (pencil → [`WireNameInlineEditor`](./WireNameInlineEditor.md) in place) when `onWireNameChange` is supplied — row click no longer opens a modal for name-only kinds; see [`WirePreviewOverrideModal`](./WirePreviewOverrideModal.md) for which kinds still do. Channel rows get an extra **Mode** column showing which mode/expansion axis each row represents.

**Tracking:** [#349](https://github.com/pskillen/codeplug-studio/issues/349) · inline edit + Mode column [#1217](https://github.com/pskillen/codeplug-studio/issues/1217)

## Props

| Prop                   | Type                               | Description                                                                                  |
| ---------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------- |
| `rows`                 | `WirePreviewRow[]`                 | Rows from `previewWireRows` (already filtered by parent)                                     |
| `onRowActivate`        | `(row) => void`                    | Row click handler — opens override modal (projection rows only when nested)                  |
| `entityKind`           | `WirePreviewEntityKind` (optional) | When `channel`, multi-projection rows nest under shaded parents (#560)                       |
| `channelOverrides`     | `BuildEntityOverride[]` (optional) | Parent-id Skip state for nest chrome                                                         |
| `search`               | `string` (optional)                | Client-side filter query                                                                     |
| `onSearchChange`       | `(value) => void` (optional)       | Search input handler                                                                         |
| `sort`                 | `DataTableSortState` (optional)    | Controlled sort state                                                                        |
| `onSortChange`         | `(state) => void` (optional)       | Sort change handler                                                                          |
| `reorder`              | `WirePreviewReorderConfig` (opt.)  | Enables **`reorderMode`** + order column; optional **`bulkReorder`** for multi-select + drag |
| `selectedKeys`         | `string[]` (optional)              | Controlled selection when `reorder.bulkReorder` is true                                      |
| `onSelectedKeysChange` | `(keys) => void` (optional)        | Selection change handler                                                                     |
| `locationByKey`        | `Map<string, number>` (optional)   | CHIRP memory `Location` column                                                               |
| `zoneScanColumn`       | `WirePreviewZoneScanColumnConfig`  | DM32 / Anytone **Zones** route — per-row export-as-scan-list switch                          |
| `inclusionColumn`      | `WirePreviewInclusionColumnConfig` | Inline **Skip** / **Force export** (name-adjacent)                                           |
| `emptyMessage`         | `string` (optional)                | Shown when `rows` is empty                                                                   |
| `nameLimit`            | `number` (optional)                | Export name length limit — feeds the inline editor + remediation marker tooltips             |
| `onWireNameChange`     | `(row, wireName) => void` (opt.)   | Enables inline Export name editing; omit to keep the column read-only                        |
| `channelsById`         | `Map<string, Channel>` (optional)  | Channel rows only — enables per-`ChannelExportNameMode` suggestions (ux-proposal.md §6a)     |
| `build`                | `RadioBuild` (optional)            | Feeds the channel inline editor's Resolution section and the optional resolution columns     |
| `library`              | `LibrarySlice \| null` (optional)  | Same — both `build` and `library` (plus `channelsById` for channels) are required to render  |

## Behaviour

- When **`entityKind` is `channel`** and multiple preview rows share a `libraryEntityId`, the table inserts a **shaded parent** row (library label + projection count badge + chevron). Children are indented; collapse is local UI state. Parent **Skip** writes `excluded` on the parent channel id (all projections); child **Skip** / wire-name modal use the projection `key` (#351 / #560). Single-row channels stay flat (no nest chrome).
- When **`inclusionColumn`** is set, a **Skip / Force** column shows Skip from export (or Force export for library nested-only zones). Clicks stop propagation.
- **Export name** column edits inline when `onWireNameChange` is set: read state is a label + [`WireNameRemediationMarker`](./WireNameRemediationMarker.md) + pencil; the pencil swaps in [`WireNameInlineEditor`](./WireNameInlineEditor.md). Multi-field overrides (zone Members/Scan, CHIRP scan inclusion) still use the modal — see caller wiring in `BuildWirePreviewListPage`.
- **Mode** column (channel rows only) shows `row.channelMode` as a small badge — sourced from `previewWireRows`' per-row projected mode (m×n site fan-out / multi-mode expansion) with `expansionNote` as a tooltip when present. No new domain logic; surfaces data the resolver/expansion already computes.
- **Search and sort** are UI-only when not in reorder mode; they do **not** persist to export order or `orderOrSlot`. Nest search keeps parent chrome when a child matches.
- When **`reorder`** is set, the table runs in **`reorderMode`** (locked to `rows` order; column sorts off). Up/down `ActionIcon`s call `onMove`; drag handles and toolbar **Move** when `bulkReorder` is true (`onSetOrder` persists). Clicks stop propagation so they do not open the modal. Nest parent/child rows are not selectable or draggable.
- Parents may show [`ExportOrderOverrideBanner`](./ExportOrderOverrideBanner.md) when `orderOrSlot` (or member layout order) is overridden — reset is separate from this table’s display sort.
- **Export status badges** — skip, force-export, library omit, expansion notes via `rowEffectivelyIncluded`. Zone rows with a build member-order layout hint show **Custom member order**.
- **Resolution columns** (channel: Transmit / TX permit / Talker alias / Analog squelch; zone: Zone-derived scan include/skip count) are hideable, `defaultVisible: false` — same column-visibility picker as **Details**. Only rendered when `build` and `library` are both supplied; see [`WireResolutionSection`](./WireResolutionSection.md) for the matching row-editor reading.

## Related

- [wire-preview.md](../../../../docs/features/builds/wire-preview.md)
- [ExportOrderOverrideBanner.md](./ExportOrderOverrideBanner.md)
- [WirePreviewOverrideModal.md](./WirePreviewOverrideModal.md)
- [WireNameInlineEditor.md](./WireNameInlineEditor.md)
- [WireNameRemediationMarker.md](./WireNameRemediationMarker.md)
- [WirePreviewExportNameCell.md](./WirePreviewExportNameCell.md)
- [WireResolutionSection.md](./WireResolutionSection.md)
- `BuildWirePreviewListPage` route wrapper
- `groupWirePreviewChannelRows` — presentation grouping over flat `previewWireRows`
