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

Selection, reorder, nesting, scale, column visibility, and row-activate props land in later commits on this same file — see the component's own type exports for the current full surface.

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
