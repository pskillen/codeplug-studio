# SelectedItemList

## Purpose

Scrollable list of **selected** items with optional filter, multi-select checkboxes, per-row remove, and a toolbar slot. Used for ordered membership UIs (zone members, RX list members).

## Props

| Prop             | Type                                             | Description                            |
| ---------------- | ------------------------------------------------ | -------------------------------------- |
| `title`          | `ReactNode`                                      | Panel heading                          |
| `description`    | `ReactNode`                                      | Optional subtitle (counts, hints)      |
| `filter`         | `{ value, onChange, placeholder?, aria-label? }` | Optional filter field                  |
| `itemKeys`       | `readonly TKey[]`                                | Ordered item keys to render            |
| `selectedKeys`   | `readonly TKey[]`                                | Keys checked for bulk toolbar actions  |
| `onToggleSelect` | `(key: TKey) => void`                            | Toggle row selection                   |
| `onRemove`       | `(key: TKey) => void`                            | Remove one row                         |
| `renderItem`     | `(ctx) => ReactNode`                             | Row content; receives select/remove    |
| `emptyMessage`   | `string`                                         | Shown when `itemKeys` is empty         |
| `maxHeight`      | `number`                                         | `ScrollArea` max height (default 360)  |
| `toolbar`        | `ReactNode`                                      | Actions below the list (reorder, etc.) |

## Usage

```tsx
import { SelectedItemList } from '@app/components/ui/index.ts';

<SelectedItemList
  title="In this zone"
  description="3 members — export order"
  filter={{ value: q, onChange: setQ, placeholder: 'Filter members…' }}
  itemKeys={keys}
  selectedKeys={selected}
  onToggleSelect={toggle}
  onRemove={remove}
  renderItem={({ itemKey, selected, onToggleSelect, onRemove }) => (
    <MyRow key={itemKey} ... />
  )}
  toolbar={<Button onClick={moveUp}>Move up</Button>}
/>;
```

## Related

- [AvailableItemPicker](./AvailableItemPicker.md) — paired pool picker
- [zone-member-picker.md](../../../../docs/features/library/zone-member-picker.md)
- Dev demos: `/styleguide`
