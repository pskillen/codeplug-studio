# EntityListDeleteAction

## Purpose

Row-level trash icon for library `DataTable` lists. Same delete flow as [`EntityDeleteButton`](./EntityDeleteButton.tsx); blocked deletes use `window.alert`.

## Props

| Prop             | Type                | Description                          |
| ---------------- | ------------------- | ------------------------------------ |
| `kind`           | `LibraryEntityKind` | Entity type                          |
| `entityId`       | `string`            | Target entity UUID                   |
| `label`          | `string`            | Display name for confirm and tooltip |
| `confirmMessage` | `string`            | Optional `window.confirm` override   |

## Usage

```tsx
import EntityListDeleteAction from '@app/components/library/EntityListDeleteAction.tsx';

{
  key: 'actions',
  header: '',
  hideable: false,
  render: (row) => (
    <EntityListDeleteAction kind="zone" entityId={row.id} label={row.name} />
  ),
}
```

## Behaviour

- `stopPropagation` on click so row navigation does not fire.
- Channel lists use [`ChannelListDeleteAction`](./ChannelListDeleteAction.tsx) for zone cascade.

## Related

- [DataTable](../../../docs/features/app-shell/data-table.md)
- [Library CRUD](../../../docs/features/library/README.md)
