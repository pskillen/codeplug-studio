# DataTable (v2)

CSS-grid data table — the design-system-v2 port of the mk2 DS `DataTable` spec, built up incrementally: core (columns/sort/search/counts) → selection/bulk/gated rows → reorder/bulk reorder → nesting/scale/column visibility/row activate.

## Purpose

The full-capability list/detail table used across library lists, wire preview, and directory search. This is a **new, independent** implementation living under `v2/` — it coexists with `components/ui/DataTable` (still reused as-is by existing v1/mixed screens) until a later migration consolidates call sites. See [datatable-capability-inventory.md](../../../../tmp/design-system-prep/datatable-capability-inventory.md) for the full requirements trace.

## Props (core)

| Prop                    | Type                                            | Notes                                                                  |
| ----------------------- | ----------------------------------------------- | ---------------------------------------------------------------------- |
| `columns`               | `DataTableColumn<T>[]`                          | `{ key, header, render, width?, align?, sortable?, sortValue?, dim? }` |
| `rows`                  | `T[]`                                           | Required                                                               |
| `getRowId`              | `(row: T) => string`                            | Required                                                               |
| `variant`               | `'list' \| 'embedded'`                          | Default `list`                                                         |
| `caption`               | `ReactNode`                                     | Footer caption text                                                    |
| `emptyMessage`          | `ReactNode`                                     | Default `No items`                                                     |
| `filteredEmptyMessage`  | `ReactNode`                                     | Shown instead when `totalRowCount > 0` but `rows` is empty             |
| `sort` / `onSortChange` | `DataTableSortState \| null` / `(sort) => void` | Controlled sort; uncontrolled if omitted                               |
| `search`                | `{ value, onChange, placeholder?, pending? }`   | Toolbar search input                                                   |
| `totalRowCount`         | `number`                                        | Drives "Showing N of M" / filtered-empty detection                     |
| `resultCount`           | `number`                                        | Displayed count override                                               |
| `countLabel`            | `(displayed, total) => ReactNode`               | Custom count copy                                                      |

## Props (selection)

| Prop                | Type                       | Notes                                                                                   |
| ------------------- | -------------------------- | --------------------------------------------------------------------------------------- |
| `selectable`        | `boolean`                  | Adds a checkbox column + selection toolbar                                              |
| `selectedKeys`      | `string[]`                 | Controlled selection; uncontrolled if omitted                                           |
| `onSelectionChange` | `(keys: string[]) => void` |                                                                                         |
| `isRowSelectable`   | `(row: T) => boolean`      | Rows failing this render a disabled, dimmed checkbox and are excluded from "select all" |
| `bulkActions`       | `ReactNode`                | Slot in the selection toolbar, shown alongside a Clear action                           |
| `onClearSelection`  | `() => void`               | Clear-selection toolbar action                                                          |

## Props (reorder)

| Prop          | Type                      | Notes                                                                             |
| ------------- | ------------------------- | --------------------------------------------------------------------------------- |
| `reorderMode` | `boolean`                 | Disables column sort; locks display to `rows` order; adds a leading Order column  |
| `onReorder`   | `(nextRows: T[]) => void` | Called by both per-row and bulk move controls with the recomputed row order       |
| `bulkReorder` | `boolean`                 | Adds Move up/down to the selection toolbar. Requires `selectable` + `reorderMode` |

Per-row and bulk moves both use the same block-move algorithm as the zone/RGL/scan membership reorder (`reorderSelectedKeys` from `@core/domain/zoneOrder.ts`) — a single row is just a one-key selection. **Scope note:** this ships up/down move controls, not drag-and-drop; the capability inventory lists a drag handle as optional ("up/down (optionally + drag handle)"). Full drag parity with `components/ui/DataTable`'s dnd-kit reorder is tracked as follow-up debt rather than forked into this CSS-grid layout in this PR.

Nesting, scale, column visibility, and row-activate props land in later commits on this same file — see the component's own type exports for the current full surface.

## Usage

```tsx
import { DataTable, DesignSystemV2Provider } from '@app/components/v2';

<DesignSystemV2Provider>
  <DataTable
    columns={[
      {
        key: 'name',
        header: 'Name',
        render: (row) => row.name,
        sortable: true,
        sortValue: (row) => row.name,
      },
    ]}
    rows={rows}
    getRowId={(row) => row.id}
  />
</DesignSystemV2Provider>;
```

## Behaviour

- Must render inside `DesignSystemV2Provider`.
- Renders as a CSS Grid (`role="table"`/`"row"`/`"columnheader"`/`"cell"`), not a native `<table>`, per the DS spec's computed `gridTemplateColumns` layout.
- Sort cycles asc → desc → unsorted (original `rows` order) per header click.
- Live demos: `/styleguide/v2/data-display`

## Related

- [RowActionIcon.md](./RowActionIcon.md)
- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
