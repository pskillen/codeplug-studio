# SelectedItemDragHandle

Grip button for role-**C** membership rows. Wire `dragHandle` from [`SelectedItemList`](./SelectedItemList.md) `renderItem`.

When `dragHandle` is `null`/absent, renders a decorative non-interactive grip (filter active or reorder not enabled).

```tsx
<SelectedItemDragHandle dragHandle={dragHandle} />
```
