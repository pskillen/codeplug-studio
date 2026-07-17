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

- **In list** — `SelectedItemList` reorder mode: drag handles, built-in Move up / Move down / Remove selected / Alt+↑/↓; `reorderScanListMembers` from core. Sort… in toolbar.
- **Add** — `AvailableItemPicker` (role B) of channels not already members; Add selected appends in stage order.
- Display filter of the add pool does not change export order.

## Related

- [scan-lists.md](../../../../docs/features/library/scan-lists.md)
- [SelectedItemList.md](../ui/SelectedItemList.md)
- [AvailableItemPicker.md](../ui/AvailableItemPicker.md)
- [`reorderScanListMembers`](../../../../src/core/domain/membershipOrder.ts)
