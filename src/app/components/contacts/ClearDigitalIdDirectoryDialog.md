# ClearDigitalIdDirectoryDialog

## Purpose

Double-confirm modal for wiping directory shadow rows — either the **entire partition** or only rows **matching the current list filters**.

## Props

| Prop         | Type                                      | Description                                                     |
| ------------ | ----------------------------------------- | --------------------------------------------------------------- |
| `opened`     | `boolean`                                 | Modal visibility                                                |
| `onClose`    | `() => void`                              | Dismiss handler (ignored while delete is running)               |
| `mode`       | `'all' \| 'filtered'`                     | Full partition wipe vs delete rows matching active filters      |
| `entryCount` | `number`                                  | Rows that will be deleted (partition total or filtered `total`) |
| `onConfirm`  | `() => Promise<{ deletedCount: number }>` | Persistence delete callback                                     |

## Behaviour

1. **Clear directory** (`mode: 'all'`) — `entryCount` must be the full partition count from `countDigitalIdDirectoryEntries`, not the filtered page total.
2. **Delete matching filters** (`mode: 'filtered'`) — enabled when any directory filter is active; `entryCount` is the filtered total from `queryDigitalIdDirectoryPage`.
3. Confirm checkbox required before the destructive button enables.
4. Library digital contacts are never deleted.

## Related

- [`DigitalIdDirectoryListPage`](../../routes/library/lists/DigitalIdDirectoryListPage.tsx)
- [contact-directories](../../../../docs/features/contact-directories/README.md)
