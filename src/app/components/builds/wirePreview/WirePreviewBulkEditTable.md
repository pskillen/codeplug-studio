# WirePreviewBulkEditTable

Bulk editor for channel wire names and skip-from-export on `/builds/:id/channels/bulk`.

## Purpose

Shows every preview row in edit mode at once. Wire-name drafts are owned by the parent page, which commits them with one **Save**. Skip toggles still persist immediately.

## Props

| Prop                       | Type                                            | Description                                     |
| -------------------------- | ----------------------------------------------- | ----------------------------------------------- |
| `rows`                     | `WirePreviewRow[]`                              | Preview rows from `useBuildWirePreview`         |
| `nameLimit`                | `number` (optional)                             | Profile name ceiling for validation             |
| `onExcludedChange`         | `(row, excluded) => void`                       | Immediate skip toggle persist                   |
| `onPendingWireNamesChange` | `Dispatch<SetStateAction<Map<string, string>>>` | Updates the parent-owned pending map            |
| `draftEpoch`               | `number` (optional)                             | Bump after Save to remount cleared draft inputs |

## Behaviour

- Each row uses `WireNameOverrideInput` with `deferCommit` — no per-row Apply/Revert.
- Default suggestion clicks fill the draft only (still require page Save to persist).
- Parent owns the Save button and calls `setRowWireNames` with the pending map, then clears pending and bumps `draftEpoch`.

## Related

- [wire-preview.md](../../../../docs/features/builds/wire-preview.md)
- `BuildChannelsBulkEditPage`
- [`WireNameOverrideInput`](./WireNameOverrideInput.tsx)
