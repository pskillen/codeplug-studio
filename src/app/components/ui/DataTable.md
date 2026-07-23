# DataTable

Reusable sortable list table for library entity lists (role **A**), wire preview, embedded pickers, and extreme-scale inventories (role **D** via `scale="extreme"`).

## Purpose

Mantine `Table` wrapper with toolbar search, sticky header, optional column visibility, row selection, order mode, and windowed tbody rendering for large row sets. Library list routes use `variant="list"`; pickers use `variant="embedded"`.

See [list-kit-roles.md](../../../../docs/features/app-shell/list-kit-roles.md).

## Props

| Prop                                                                                | Type                     | Notes                                                                                                |
| ----------------------------------------------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------- |
| `rows` / `rowKey`                                                                   | `T[]`, `(row) => string` | Full in-memory row set                                                                               |
| `nameColumn`                                                                        | `DataTableLinkedColumn`  | Linked name (`getName`, `getPath`, optional `render`, `sortable`, `sortValue`, `header`)             |
| `callsignColumn?`                                                                   | `DataTableLinkedColumn`  | Optional second linked column                                                                        |
| `columns`                                                                           | `DataTableColumn[]`      | Extra columns (`key`, `header`, `render`, `sortable?`, `sortValue?`, `hideable?`, `defaultVisible?`) |
| `variant`                                                                           | `'list' \| 'embedded'`   | List: 60vh scroll; embedded: 40vh                                                                    |
| `sort` / `onSortChange` / `defaultSort`                                             |                          | Controlled / uncontrolled sort                                                                       |
| `search` / `searchPending` / `onSearchChange` / `searchPlaceholder` / `showSearch`  |                          | Toolbar filter + debounce spinner                                                                    |
| `columnVisibility*` / storage key / load                                            |                          | Hideable column modal                                                                                |
| `selectable` / `selectedKeys` / `onSelectedKeysChange`                              |                          | Multi-select (select-all = all sorted keys)                                                          |
| `toolbar`                                                                           | `ReactNode`              | Footer bulk actions                                                                                  |
| `emptyState` / `filteredEmptyMessage` / `totalRowCount` / `resultCount` / `caption` |                          | Empty + count chrome                                                                                 |
| `onRowActivate`                                                                     | `(row) => void`          | Clickable rows; name as plain text                                                                   |
| `orderMode` / `reorderMode`                                                         | `boolean`                | Lock: disable column sort; keep `rows` order (`reorderMode` preferred)                               |
| `storedOrder`                                                                       | `boolean \| config`      | Hybrid: default `rows` order, allow other sorts, restore when drifted                                |
| `scale`                                                                             | `'default' \| 'extreme'` | `'extreme'` forces virtualisation on (role D); use cheap cells                                       |
| `virtualize`                                                                        | `boolean \| 'auto'`      | Default `'auto'` — window tbody when `rows.length >= 75`                                             |
| `estimatedRowHeight` / `virtualizeOverscan`                                         | `number`                 | Virtualizer tuning                                                                                   |
| `getRowClassName`                                                                   | `(row) => string?`       | Optional `Table.Tr` class (e.g. shaded nest parents on Channels wire preview)                        |
| `mobileColumnPolicy`                                                                | `'none' \| 'collapse'`   | Stub — only `none` implemented                                                                       |

## Usage

```tsx
<DataTable
  variant="list"
  rows={filtered}
  totalRowCount={all.length}
  rowKey={(row) => row.id}
  nameColumn={{
    getName: (row) => row.name,
    getPath: (row) => `/library/channels/${row.id}`,
  }}
  columns={[
    { key: 'band', header: 'Band', render: (row) => row.band, sortValue: (row) => row.band },
  ]}
  sort={sort}
  onSortChange={setSort}
  search={nameFilterInput}
  onSearchChange={setNameFilter}
/>
```

Large lists inherit `virtualize="auto"`. Pass `scale="extreme"` for always-on windowing (contacts-scale).

Export-order lists that should **only** mutate agreed order (Zones):

```tsx
<DataTable reorderMode rows={ordered} /* reorder column + Sort… outside */ />
```

Hybrid browse + restore (optional):

```tsx
<DataTable
  storedOrder={{
    columnKey: 'exportOrder',
    label: 'Export order',
    restoreLabel: 'Return to export order',
  }}
  columns={[{ key: 'exportOrder', header: 'Export order', render: (row) => /* reorder */ null }]}
  /* … */
/>
```

Prefer `reorderMode` when the list’s only job is agreed/export order. `storedOrder` is for hybrid browse + restore.

## Behaviour

- **Sort** — client-side via `sortDataTableRows`; thead stays outside the virtual window. Disabled in `orderMode`.
- **Stored order** — when `storedOrder` is set (and not reorder-locked), sorting by the configured key keeps `rows` (asc) or reverses them (desc). Elevated header + restore button when drifted. Distinct from MembershipSortMenu.
- **Reorder mode** — `reorderMode` / `orderMode`: headers are plain text; display order is `rows` as passed (Zones default).
- **Extreme scale** — forces virtualisation regardless of row count; prefer plain-text cells.
- **Scroll parent** — Mantine `ScrollArea.Autosize` viewport is the virtualizer scroll element; sticky `.stickyTh` header remains in `thead`.
- **Virtual tbody** — spacer rows pad top/bottom; only visible rows (+ overscan) mount as `Table.Tr`.
- **Selection** — select-all toggles all sorted row keys in memory, not only visible checkboxes.
- **Demos** — `/styleguide/data-table`.

Implementation: `useVirtualDataTableRows` in `src/app/lib/dataTable/`, constants in `virtualization.ts`.

## Related

- [data-table.md](../../../../docs/features/app-shell/data-table.md)
- [list-kit-roles.md](../../../../docs/features/app-shell/list-kit-roles.md)
- Virtualisation: [#381](https://github.com/pskillen/codeplug-studio/issues/381)
