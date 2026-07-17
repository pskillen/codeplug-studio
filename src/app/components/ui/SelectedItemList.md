# SelectedItemList

## Purpose

Scrollable list of **selected** items (role **C**) with optional filter, multi-select, per-row remove, built-in bulk reorder/remove, and a toolbar slot. Used for ordered membership UIs (zone members, RX list members).

## Props

| Prop                        | Type                                             | Description                                                      |
| --------------------------- | ------------------------------------------------ | ---------------------------------------------------------------- |
| `title`                     | `ReactNode`                                      | Panel heading                                                    |
| `description`               | `ReactNode`                                      | Optional subtitle (counts, hints)                                |
| `filter`                    | `{ value, onChange, placeholder?, aria-label? }` | Optional find-in-list filter                                     |
| `itemKeys`                  | `readonly TKey[]`                                | Ordered item keys to render                                      |
| `selectedKeys`              | `readonly TKey[]`                                | Keys checked for bulk toolbar actions                            |
| `onToggleSelect`            | `(key: TKey) => void`                            | Toggle row selection                                             |
| `onRemove`                  | `(key: TKey) => void`                            | Remove one row                                                   |
| `renderItem`                | `(ctx) => ReactNode`                             | Row content; receives select/remove — put membership props here  |
| `emptyMessage`              | `string`                                         | Shown when `itemKeys` is empty                                   |
| `maxHeight`                 | `number`                                         | `ScrollArea` max height (default 360)                            |
| `toolbar`                   | `ReactNode`                                      | Extra actions below built-in controls (e.g. sort menu)           |
| `onMoveSelected`            | `(direction: 'up' \| 'down') => void`            | Built-in Move up / Move down                                     |
| `onRemoveSelected`          | `() => void`                                     | Built-in Remove selected                                         |
| `canMoveUp` / `canMoveDown` | `boolean`                                        | Disable edge move buttons (default true)                         |
| `reorderHint`               | `ReactNode`                                      | Override default Alt+↑/↓ hint                                    |
| `enableReorderHotkeys`      | `boolean`                                        | Alt+ArrowUp/Down → `onMoveSelected` (default true when move set) |

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
  onMoveSelected={move}
  onRemoveSelected={removeBulk}
  canMoveUp={canUp}
  canMoveDown={canDown}
  renderItem={({ itemKey, selected, onToggleSelect, onRemove }) => (
    <MyRow key={itemKey} ... />
  )}
/>;
```

## Behaviour

- Built-in reorder/remove appear when the corresponding handlers are passed.
- Hotkeys listen on `window` while the component is mounted (Alt+Arrow).
- Dense membership property editors stay in `renderItem` (N is typically &lt;100).

## Related

- [AvailableItemPicker](./AvailableItemPicker.md) — paired pool picker (role B)
- [list-kit-roles.md](../../../../docs/features/app-shell/list-kit-roles.md)
- [zone-member-picker.md](../../../../docs/features/library/zone-member-picker.md)
- Dev demos: `/styleguide/membership`
