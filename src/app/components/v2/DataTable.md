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

| Prop          | Type                      | Notes                                                                                                       |
| ------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `reorderMode` | `boolean`                 | Disables column sort; locks display to `rows` order; adds a leading Order column with a per-row drag handle |
| `onReorder`   | `(nextRows: T[]) => void` | Called by both drag and bulk-toolbar moves with the recomputed row order                                    |
| `bulkReorder` | `boolean`                 | Adds Move up/down to the selection toolbar. Requires `selectable` + `reorderMode`                           |

Per-row reorder is a **grip drag handle** (`SelectedItemDragHandle`, the same primitive `ShuttleRow` uses), not up/down buttons — reusing the generic `DataTableBulkReorderProvider`/`DataTableBulkReorderSortable` dnd-kit wrapper and `reorderKeysByDrag`/`reorderSelectedKeys` from `@core/domain/zoneOrder.ts` (the same algorithms `components/ui/DataTable`'s bulk-reorder drag uses — not reimplemented). Dragging a selected row moves the whole selected block together. The selection toolbar additionally exposes **Move up/down buttons** for reordering the current selection without dragging (keyboard/non-pointer path), per the capability doc's "up/down (optionally + drag handle)" — both mechanisms call the same `onReorder`. Order numbering/dragging is top-level only; nested child rows and parent (has-children) rows don't reorder, matching the capability doc's "non-reorderable parents."

## Props (nesting, scale, column visibility, row activate)

| Prop                  | Type                                    | Notes                                                                                               |
| --------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `nested`              | `boolean`                               | Adds an expand/collapse lead column                                                                 |
| `getChildren`         | `(row: T) => T[] \| undefined`          | Recursive — expanded children render indented (16px per depth)                                      |
| `scale`               | `'default' \| 'extreme'`                | `'extreme'` adds a sticky header + 440px max-height scroll region for dense tables                  |
| `visibleKeys`         | `string[]`                              | Controlled visibility for `hideable` columns; uncontrolled (per-column `defaultVisible`) if omitted |
| `onVisibleKeysChange` | `(keys: string[]) => void`              | Paired with the "Show/hide cols" toggle                                                             |
| `onRowActivate`       | `(row: T) => void`                      | Makes rows clickable; disabled for rows failing `isRowSelectable` when `selectable` is set          |
| `getRowVariant`       | `(row: T) => 'nestParent' \| undefined` | `'nestParent'` gives the row a quiet background                                                     |

Column-level `hideable`/`defaultVisible`/`hideOnMobile` live on `DataTableColumn`. Mobile collapse uses `useMediaQuery(MOBILE_MAX_WIDTH_MEDIA_QUERY)` (viewport-width based, matching the existing `components/ui/DataTable` convention) rather than a per-instance `ResizeObserver` — a deliberate deviation from the DS bundle's approach for consistency with how this codebase already solves the same problem. The column-visibility toggle is a small self-contained dropdown (not Mantine `Popover`) — `Popover.Target` requires a ref-forwarding child and `v2/Button` doesn't forward refs, so a custom absolutely-positioned panel was simpler and more testable than fixing that dependency chain.

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
- Lead columns (nested expander, checkbox) use a dedicated `.leadCell` style (tight, symmetric padding) rather than the regular 16px `.dataCell`/`.headerCell` padding, which doesn't leave room for icon/control-only content in a narrow column.
- Live demos: `/styleguide/v2/data-display`

## Related

- [RowActionIcon.md](./RowActionIcon.md)
- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
