# ScanListMemberEditor

## Purpose

Ordered channel membership for a library [`ScanList`](../../../../docs/features/library/scan-lists.md). **List order is export order.**

## Props

| Prop               | Type                      | Description                            |
| ------------------ | ------------------------- | -------------------------------------- |
| `channels`         | `Channel[]`               | Library channels for labels / add pool |
| `memberChannelIds` | `string[]`                | Ordered UUID FKs (export order)        |
| `onChange`         | `(ids: string[]) => void` | Replace membership array               |

## Usage

```tsx
<ScanListMemberEditor
  channels={library.channels}
  memberChannelIds={memberChannelIds}
  onChange={setMemberChannelIds}
/>
```

## Behaviour

- **In list** — `SelectedItemList` with Move up / Move down / Remove selected; uses `reorderScanListMembers` from core.
- **Add** — MultiSelect of channels not already members; appends in selection order.
- Display sort of the add pool does not change export order.

## Related

- [scan-lists.md](../../../../docs/features/library/scan-lists.md)
- [SelectedItemList.md](../ui/SelectedItemList.md)
- [`reorderScanListMembers`](../../../../src/core/domain/membershipOrder.ts)
