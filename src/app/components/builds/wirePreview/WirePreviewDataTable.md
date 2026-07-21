## Purpose

Read-only wire preview list for build entity routes. Shows library label, generated/effective wire name, and export-status badges. Row click opens `WirePreviewOverrideModal`.

**Tracking:** [#349](https://github.com/pskillen/codeplug-studio/issues/349)

## Props

| Prop              | Type                               | Description                                                         |
| ----------------- | ---------------------------------- | ------------------------------------------------------------------- |
| `rows`            | `WirePreviewRow[]`                 | Rows from `previewWireRows` (already filtered by parent)            |
| `onRowActivate`   | `(row) => void`                    | Row click handler — opens override modal                            |
| `search`          | `string` (optional)                | Client-side filter query                                            |
| `onSearchChange`  | `(value) => void` (optional)       | Search input handler                                                |
| `sort`            | `DataTableSortState` (optional)    | Controlled sort state                                               |
| `onSortChange`    | `(state) => void` (optional)       | Sort change handler                                                 |
| `reorder`         | `WirePreviewReorderConfig` (opt.)  | Enables **`reorderMode`** + up/down column for `orderOrSlot`        |
| `locationByKey`   | `Map<string, number>` (optional)   | CHIRP memory `Location` column                                      |
| `zoneScanColumn`  | `WirePreviewZoneScanColumnConfig`  | DM32 / Anytone **Zones** route — per-row export-as-scan-list switch |
| `inclusionColumn` | `WirePreviewInclusionColumnConfig` | Inline **Skip** / **Force export** (name-adjacent)                  |
| `emptyMessage`    | `string` (optional)                | Shown when `rows` is empty                                          |

## Behaviour

- When **`inclusionColumn`** is set, a **Skip / Force** column shows Skip from export (or Force export for library nested-only zones). Clicks stop propagation.
- **No other per-row inputs** — overrides are edited in the modal (or channel bulk-edit route), except **Export scan list** on DM32 / Anytone zone rows when `zoneScanColumn` is set.
- **Search and sort** are UI-only when not in reorder mode; they do **not** persist to export order or `orderOrSlot`.
- When **`reorder`** is set, the table runs in **`reorderMode`** (locked to `rows` order; column sorts off). Up/down `ActionIcon`s call `onMove`; clicks stop propagation so they do not open the modal.
- Parents may show [`ExportOrderOverrideBanner`](./ExportOrderOverrideBanner.md) when `orderOrSlot` (or member layout order) is overridden — reset is separate from this table’s display sort.
- **Export status badges** — skip, force-export, library omit, expansion notes via `rowEffectivelyIncluded`. Zone rows with a build member-order layout hint show **Custom member order**.

## Related

- [wire-preview.md](../../../../docs/features/builds/wire-preview.md)
- [ExportOrderOverrideBanner.md](./ExportOrderOverrideBanner.md)
- [WirePreviewOverrideModal.md](./WirePreviewOverrideModal.md)
- `BuildWirePreviewListPage` route wrapper
