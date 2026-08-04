# ShuttleList

v2 membership shuttle UI that **reuses** the existing list-kit (`SelectedItemList` + `AvailableItemPicker`) — it does not reimplement drag-and-drop.

## Purpose

Design-system “shuttle list” (pool ↔ members) for zone/scan/RX membership editors. Visual chrome is v2; interaction behaviour stays in `components/ui/SelectedItemList` and `AvailableItemPicker`.

## Exports

| Export              | Role                                                            |
| ------------------- | --------------------------------------------------------------- |
| `ShuttleListPanel`  | Styled panel wrapping `SelectedItemList` (alias: `ShuttleList`) |
| `ShuttlePoolPanel`  | Styled panel wrapping `AvailableItemPicker`                     |
| `ShuttleRow`        | Member row — return this from `SelectedItemList` `renderItem`   |
| `ShuttlePoolHeader` | Pool-side section header with optional count                    |
| `ShuttleAddBar`     | Footer “Add selected” action                                    |

## Props (ShuttleRow)

| Prop             | Type                                  | Notes                                            |
| ---------------- | ------------------------------------- | ------------------------------------------------ |
| `label`          | `ReactNode`                           | Primary text                                     |
| `subtitle`       | `ReactNode`                           | Secondary line                                   |
| `selected`       | `boolean`                             | From `renderItem`                                |
| `onToggleSelect` | `() => void`                          | From `renderItem`                                |
| `onRemove`       | `() => void`                          | From `renderItem`                                |
| `dragHandle`     | `SelectedItemDragHandleProps \| null` | Wire to `SelectedItemDragHandle` — do not invent |
| `trailing`       | `ReactNode`                           | Optional pills / controls                        |

`ShuttleListPanel` accepts the full `SelectedItemListProps` surface plus optional `className`.

## Usage

```tsx
<ShuttleListPanel
  title="In this zone"
  itemKeys={keys}
  selectedKeys={selected}
  onToggleSelect={toggle}
  onRemove={remove}
  onReorder={setKeys}
  renderItem={({ itemKey, selected, onToggleSelect, onRemove, dragHandle }) => (
    <ShuttleRow
      key={itemKey}
      label={labels[itemKey]}
      selected={selected}
      onToggleSelect={onToggleSelect}
      onRemove={onRemove}
      dragHandle={dragHandle}
    />
  )}
/>

<ShuttlePoolPanel
  title="Available"
  sections={[…]}
  footer={<ShuttleAddBar onAdd={add} selectedCount={n} disabled={n === 0} />}
/>
```

## Behaviour

- **Delegates DnD** to `SelectedItemList` / dnd-kit. If the render-prop shape ever proves too awkward to skin, fall back to a standalone row and revisit reuse — do not fork a second drag implementation in this ticket.
- Must render inside `DesignSystemV2Provider`.
- Live demos: `/styleguide/v2/patterns`

## Related

- [SelectedItemList.md](../ui/SelectedItemList.md)
- [AvailableItemPicker.md](../ui/AvailableItemPicker.md)
- [lists-and-ordering.md](../../../../docs/reference/styleguide/lists-and-ordering.md)
- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
