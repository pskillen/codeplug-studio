# DataTable

Reusable sortable list table for library entity lists, wire preview, and embedded pickers.

## Purpose

Mantine `Table` wrapper with toolbar search, sticky header, optional column visibility, row selection, and windowed tbody rendering for large row sets. Library list routes use `variant="list"`; pickers use `variant="embedded"`.

## Props (selected)

| Prop | Type | Notes |
| --- | --- | --- |
| `rows` / `rowKey` | `T[]`, `(row) => string` | Full in-memory row set |
| `nameColumn` | `DataTableLinkedColumn` | Linked name cell (`getName`, `getPath`) |
| `columns` | `DataTableColumn[]` | Extra columns; `sortValue` when sortable |
| `variant` | `'list' \| 'embedded'` | List: 60vh scroll; embedded: 40vh |
| `virtualize` | `boolean \| 'auto'` | Default `'auto'` — window tbody when `rows.length >= 75` |
| `estimatedRowHeight` | `number` | Virtualizer estimate; default 44px (56px when `onRowActivate` set) |
| `virtualizeOverscan` | `number` | Extra rows above/below viewport; default 8 |
| `selectable` / `selectedKeys` | | Bulk selection operates on sorted keys in memory |
| `onRowActivate` | `(row) => void` | Clickable rows; name column renders as plain text |

See [data-table.md](../../../../docs/features/app-shell/data-table.md) for list prefs, hooks, and entity list wiring.

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
  columns={[{ key: 'band', header: 'Band', render: (row) => row.band, sortValue: (row) => row.band }]}
  sort={sort}
  onSortChange={setSort}
  search={nameFilterInput}
  onSearchChange={setNameFilter}
/>
```

Large lists inherit `virtualize="auto"` with no extra props. Pass `virtualize={false}` to force full DOM render (e.g. debugging).

## Behaviour

- **Sort** — client-side via `sortDataTableRows`; thead stays outside the virtual window.
- **Scroll parent** — Mantine `ScrollArea.Autosize` viewport (`viewportRef`) is the virtualizer scroll element; sticky `.stickyTh` header remains in `thead`.
- **Virtual tbody** — spacer rows pad top/bottom; only visible rows (+ overscan) mount as `Table.Tr`.
- **Selection** — select-all toggles all sorted row keys in memory, not only visible checkboxes.
- **Demos** — `/styleguide` → **DataTable — large virtual list** (250 rows).

Implementation: `useVirtualDataTableRows` in `src/app/lib/dataTable/`, constants in `virtualization.ts`.

## Related

- [data-table.md](../../../../docs/features/app-shell/data-table.md)
- [datatable-virtualization-progress.md](../../../../docs/features/app-shell/datatable-virtualization-progress.md)
