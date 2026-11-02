# DataTable (v2)

CSS-grid data table — the design-system-v2 port of the mk2 DS `DataTable` spec, built up incrementally: core (columns/sort/search/counts) → selection/bulk/gated rows → reorder/bulk reorder → nesting/scale/column visibility/row activate.

## Purpose

The full-capability list/detail table used across library lists, wire preview, builds, and directory search. Sole product `DataTable` after v1 retire ([#927](https://github.com/pskillen/codeplug-studio/issues/927)). See [datatable-capability-inventory.md](../../../../tmp/design-system-prep/datatable-capability-inventory.md) for the full requirements trace.

## Props (core)

| Prop                    | Type                                            | Notes                                                                                                      |
| ----------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `columns`               | `DataTableColumn<T>[]`                          | `{ key, header, render, width?, align?, sortable?, sortValue?, dim? }` — default track `minmax(8rem, 1fr)` |
| `rows`                  | `T[]`                                           | Required                                                                                                   |
| `getRowId`              | `(row: T) => string`                            | Required                                                                                                   |
| `variant`               | `'list' \| 'embedded'`                          | Default `list`                                                                                             |
| `caption`               | `ReactNode`                                     | Footer caption text                                                                                        |
| `emptyMessage`          | `ReactNode`                                     | Default `No items`                                                                                         |
| `filteredEmptyMessage`  | `ReactNode`                                     | Shown instead when `totalRowCount > 0` but `rows` is empty                                                 |
| `sort` / `onSortChange` | `DataTableSortState \| null` / `(sort) => void` | Controlled sort; uncontrolled if omitted                                                                   |
| `search`                | `{ value, onChange, placeholder?, pending? }`   | Toolbar search input                                                                                       |
| `totalRowCount`         | `number`                                        | Drives "Showing N of M" / filtered-empty detection                                                         |
| `resultCount`           | `number`                                        | Displayed count override                                                                                   |
| `countLabel`            | `(displayed, total) => ReactNode`               | Custom count copy                                                                                          |

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

Per-row reorder is a **grip drag handle** (`SelectedItemDragHandle`), reusing the generic `DataTableBulkReorderProvider`/`DataTableBulkReorderSortable` dnd-kit wrapper and `reorderKeysByDrag`/`reorderSelectedKeys` from `@core/domain/zoneOrder.ts`. Dragging a selected row moves the whole selected block together.

## Props (nesting, scale, column visibility, row activate)

| Prop                                        | Type                                                | Notes                                                                                                                                                 |
| ------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nested`                                    | `boolean`                                           | Adds an expand/collapse lead column                                                                                                                   |
| `getChildren`                               | `(row: T) => T[] \| undefined`                      | Recursive — expanded children render indented (16px per depth)                                                                                        |
| `scale`                                     | `'default' \| 'extreme'`                            | `'extreme'` adds a sticky header + 440px max-height scroll region for dense tables                                                                    |
| `stickyHeader`                              | `boolean`                                           | Header row stays on screen while the page or pane scrolls down. Default `true` for `variant="list"`, off for `embedded`; `extreme` always has its own |
| `stickyFirstColumn`                         | `boolean`                                           | Pins the first visible data column plus leading controls (expander, checkbox, Order) while the table scrolls sideways. Default off                    |
| `virtualize`                                | `boolean \| 'auto'`                                 | Default `'auto'` — window tbody when `rows.length >= 75`; `'extreme'` scale forces virtualization on                                                  |
| `estimatedRowHeight` / `virtualizeOverscan` | `number`                                            | Virtualizer tuning (see `src/app/lib/dataTable/virtualization.ts`)                                                                                    |
| `visibleKeys`                               | `string[]`                                          | Controlled visibility for `hideable` columns; uncontrolled (per-column `defaultVisible`) if omitted                                                   |
| `onVisibleKeysChange`                       | `(keys: string[]) => void`                          | Paired with the "Show/hide cols" toggle                                                                                                               |
| `onRowActivate`                             | `(row: T) => void`                                  | Makes rows clickable; disabled for rows failing `isRowSelectable` when `selectable` is set                                                            |
| `getRowVariant`                             | `(row: T) => 'nestParent' \| 'active' \| undefined` | `'nestParent'` quiet background; `'active'` accent tint for live in-progress rows (e.g. above-horizon passes)                                         |
| `mobileIdentity`                            | `(row: T) => ReactNode`                             | Mobile only: a per-row identity line (checkbox + this content) that stays put while the row's cells scroll sideways — see below                       |
| `mobileIdentityLabel`                       | `ReactNode`                                         | Header label for the identity line (default `Name`)                                                                                                   |
| `mobileCard`                                | `(row: T) => ReactNode`                             | Replaces per-column grid cells with this card render on narrow viewports — see below                                                                  |

Column-level `hideable`/`defaultVisible`/`hideOnMobile` live on `DataTableColumn`. Mobile collapse uses `useMediaQuery(MOBILE_MAX_WIDTH_MEDIA_QUERY)` (viewport-width based) rather than a per-instance `ResizeObserver`.

### Mobile card rows

When `mobileCard` is set **and** the table is at the mobile breakpoint, each row renders a single cell containing `mobileCard(row)` instead of one grid cell per visible column — an alternative to horizontal scroll / `hideOnMobile` collapsing for tables too wide to read comfortably on a phone ([#967](https://github.com/pskillen/codeplug-studio/issues/967)). Selection checkboxes (row and "select all") and column sort headers are hidden in this mode — `selectable`/`bulkActions` are a desktop-table affordance and don't apply once rows collapse to cards. `onRowActivate` keeps working exactly as in the normal grid layout. `nested` and `reorderMode` are not exercised together with `mobileCard` by any current consumer. `sortRowsByColumn` (exported alongside `DataTableColumn`) is available for consumers that need to pre-sort rows the same way `DataTable` does, e.g. to render an alternate layout for the same data outside the table.

### Mobile identity line

`mobileIdentity` ([#1516](https://github.com/pskillen/codeplug-studio/issues/1516)) keeps a pinned first column from eating a phone screen. Below the mobile breakpoint each row gets an identity line on top (inside the same `role="row"`, spanning all tracks) holding the selection checkbox and `mobileIdentity(row)`. The line is `position: sticky; left: 0` and as wide as the scroller's visible area (`width: 100cqw`; the scrollers are inline-size containers), so it never scrolls sideways, while that row's cells below it scroll with the header. The lead checkbox track disappears from the grid, so cells still line up with header columns; the header gets a matching slim line with select-all and `mobileIdentityLabel`. Pair it with `hideOnMobile` on the column the line replaces. Put anything else that belongs beside the name (Channels: band and mode pills) inside the identity content itself, as one non-wrapping row: name truncates with an ellipsis first, the pills clip at the edge as a last resort. `stickyFirstColumn` pins nothing while the line is active. Ignored (normal layout) for `nested`, `reorderMode`, `mobileCard` and `scale="extreme"`. The dropped column's sort header is not shown on mobile; use the page's Sort control.

**Channels list:** `/library/channels` no longer passes `mobileCard` ([#1205](https://github.com/pskillen/codeplug-studio/issues/1205)) — operators choose **Table** or **Cards** explicitly; table mode stays a grid on mobile. The `mobileCard` prop remains available for other list pages.

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
- The table shell uses `overflow: auto` with touch momentum scrolling. Flexible columns default to `minmax(8rem, 1fr)` so wide layouts scroll horizontally on mobile instead of crushing every column ([#962](https://github.com/pskillen/codeplug-studio/issues/962)). On narrow viewports, `variant="list"` tables bleed the `.table` shell to the viewport edge (filters and titles above stay inset) ([#1024](https://github.com/pskillen/codeplug-studio/issues/1024)). Prefer `hideOnMobile` / column visibility for intentional collapse; when columns stay visible, horizontal swipe must work.
- **Sticky header / pinned column ([#1516](https://github.com/pskillen/codeplug-studio/issues/1516)).** `position: sticky` fails inside an `overflow-x: auto` wrapper that is not also the vertical scroller, so in "split" mode (`data-split`) the header row sits in its own `overflow: hidden` strip _outside_ the sideways scroller, sticky to whatever scrolls vertically (the window on desktop pages, the `MapSheet` body on mobile `ListMapLayout`, `main` elsewhere). The body scrolls sideways alone and its `scrollLeft` is mirrored onto the header strip. The shell uses `overflow: clip` (no scroll container) for the rounded border. Consequences: no ancestor of a sticky table may set `overflow-x`/`overflow-y` (the `ListMapLayout` list pane no longer does); header and body share a `min-width` computed from the column tracks (`trackMinWidth`) so rows are as wide as their tracks — give custom `width` tracks a real floor, not `max-content`. Offset the stuck header under pinned page chrome with `--dsv2-table-sticky-top` (default `0px`; the app header and library strip scroll away, nothing is pinned today).
- Pinned cells (`.pinned`) repaint an opaque background (`--dsv2-table-bg`: the page colour set on `AppLayout` `main`, the sheet surface inside `ListMapLayout`) plus the row tint (hover, active, nest parent), and show a right border + shadow once the body is scrolled sideways (`data-scrolled-x`). Pinned lead controls use fixed track widths (36/40/68px) as left offsets. The stuck header is `z-index: 3`, above pinned body cells (`1`), with pinned header cells at `2`, so the top-left cell wins.
- `scale="extreme"` keeps its bounded 440px scroll region with an in-region sticky header; `stickyFirstColumn` there uses plain sticky cells in that scroller.
- Live demos: `/styleguide/data-display`

## Related

- [RowActionIcon.md](./RowActionIcon.md)
- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
