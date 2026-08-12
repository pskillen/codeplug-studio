# WirePreviewBulkEditTable

Bulk editor for channel wire names and skip-from-export on `/builds/:id/channels/bulk`.

## Purpose

Shows every preview row in edit mode at once. Wire-name drafts accumulate locally; the parent page commits them with one **Save**. Skip toggles still persist immediately.

## Props

| Prop                        | Type                                            | Description                                      |
| --------------------------- | ----------------------------------------------- | ------------------------------------------------ |
| `rows`                      | `WirePreviewRow[]`                              | Preview rows from `useBuildWirePreview`          |
| `nameLimit`                 | `number` (optional)                             | Profile name ceiling for validation              |
| `onExcludedChange`          | `(row, excluded) => void`                       | Immediate skip toggle persist                    |
| `onPendingWireNamesChange`  | `(pending: Map<string, string>) => void` (opt.) | Pending drafts keyed by row `key`                |
| `onUnsavedChangesChange`    | `(hasUnsaved: boolean) => void` (optional)      | True when any pending draft exists               |
| `draftEpoch`                | `number` (optional)                             | Bump after Save to clear drafts and remount rows |

## Behaviour

- Each row uses `WireNameOverrideInput` with `deferCommit` — no per-row Apply/Revert.
- Default suggestion clicks fill the draft only (still require page Save to persist).
- Parent owns the Save button and calls `setRowWireNames` with the pending map.

## Related

- [wire-preview.md](../../../../docs/features/builds/wire-preview.md)
- `BuildChannelsBulkEditPage`
- [`WireNameOverrideInput`](./WireNameOverrideInput.tsx)
