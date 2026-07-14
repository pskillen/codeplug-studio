## Purpose

Read-only wire preview list for build entity routes. Shows library label, generated/effective wire name, and export-status badges. Row click opens `WirePreviewOverrideModal`.

**Tracking:** [#349](https://github.com/pskillen/codeplug-studio/issues/349)

## Props

| Prop             | Type                              | Description                                              |
| ---------------- | --------------------------------- | -------------------------------------------------------- |
| `rows`           | `WirePreviewRow[]`                | Rows from `previewWireRows` (already filtered by parent) |
| `onRowActivate`  | `(row) => void`                   | Row click handler — opens override modal                 |
| `search`         | `string` (optional)               | Client-side filter query                                 |
| `onSearchChange` | `(value) => void` (optional)      | Search input handler                                     |
| `sort`           | `DataTableSortState` (optional)   | Controlled sort state                                    |
| `onSortChange`   | `(state) => void` (optional)      | Sort change handler                                      |
| `reorder`        | `WirePreviewReorderConfig` (opt.) | Up/down column for `orderOrSlot` (CHIRP flat memory)     |
| `locationByKey`  | `Map<string, number>` (optional)  | CHIRP memory `Location` column                           |
| `zoneScanColumn` | `WirePreviewZoneScanColumnConfig` | DM32 / Anytone **Zones** route — per-row export-as-scan-list switch |
| `emptyMessage`   | `string` (optional)               | Shown when `rows` is empty                               |

## Behaviour

- **No per-row inputs** — overrides are edited in the modal (or channel bulk-edit route), except **Export scan list** on DM32 / Anytone zone rows when `zoneScanColumn` is set.
- **Search and sort** are UI-only; they do **not** persist to export order or `orderOrSlot`.
- **Export status badges** — skip, force-export, library omit, expansion notes via `rowEffectivelyIncluded`.
- **Reorder** — when `reorder` is set, up/down `ActionIcon`s call `onMove`; clicks stop propagation so they do not open the modal.

## Related

- [wire-preview.md](../../../../docs/features/builds/wire-preview.md)
- [WirePreviewOverrideModal.md](./WirePreviewOverrideModal.md)
- `BuildWirePreviewListPage` route wrapper
