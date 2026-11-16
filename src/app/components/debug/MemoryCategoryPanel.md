# MemoryCategoryPanel

## Purpose

One Memory category in the DM-32 shape, for any radio: a count sentence, a dimmed caveat, search, a sortable v2 `DataTable` and an optional details region for the clicked row. It knows no radio; every sentence and column comes from the caller, usually from the radio home.

## Props

| Prop                                    | Notes                                                                                             |
| --------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `summary`                               | The count sentence                                                                                |
| `caveat`                                | Dimmed lines; after two, the rest fold behind **More**                                            |
| `searchPlaceholder`, `caption`          | Search box placeholder; table caption                                                             |
| `columns`, `rows`, `getRowId`           | `DataTableColumn<T>[]` and rows; sortable columns supply `sortValue`                              |
| `searchText(row)`                       | Text a search matches (include callsign, name, slot, frequencies)                                 |
| `defaultSort`                           | Initial sort, for example slot ascending                                                          |
| `details(row)`                          | Region under the table for the clicked row; clicking again closes it. Omit for non-clickable rows |
| `mobileIdentity`, `mobileIdentityLabel` | Phone identity line, as on `DataTable`                                                            |
| `stickyFirstColumn`, `emptyMessage`     | Passed to `DataTable`                                                                             |

`identityLabel(callsign, name)` builds the identity text: callsign first, then name, `CALL · Name`; the name alone when there is no callsign, so a one-name radio shows its name complete.

## Usage

```tsx
<MemoryCategoryPanel
  summary="42 channels listed of 128 slots"
  caveat={['Each identity is the single name field.']}
  searchPlaceholder="Search channels"
  caption="Memory channels"
  columns={columns}
  rows={rows}
  getRowId={(r) => r.id}
  searchText={(r) => `${r.slot} ${r.label}`}
  defaultSort={{ key: 'slot', direction: 'asc' }}
  details={(r) => <ToneLine row={r} />}
/>
```

## Behaviour

- Wraps itself in `DesignSystemV2Provider` (dark, v2 tokens).
- Search, sort, the caveat fold and the selected row are local state; the Memory tab remounts per archive and per category.
- A row that a search hides closes its details.
- Display only; no write or capture path.

## Related

- [MemoryCategories](./MemoryCategories.md), [SettingsTable](./SettingsTable.md)
- [docs/features/radio-debug/README.md](../../../../docs/features/radio-debug/README.md)
