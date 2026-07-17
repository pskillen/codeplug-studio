# SelectedItemList

## Purpose

Scrollable list of **selected** items (role **C**) with optional filter, multi-select, per-row remove, drag-and-drop reorder, built-in bulk reorder/remove, and a toolbar slot. Used for ordered membership UIs (zone members, scan lists, RX list members).

Role **C** lives in **reorder mode**: display order is the agreed/export membership order. Permanent **Sort…** (MembershipSortMenu) rewrites that order; there is no temporary column sort.

## Props

| Prop                        | Type                                             | Description                                                           |
| --------------------------- | ------------------------------------------------ | --------------------------------------------------------------------- |
| `title`                     | `ReactNode`                                      | Panel heading                                                         |
| `description`               | `ReactNode`                                      | Optional subtitle (counts, hints)                                     |
| `filter`                    | `{ value, onChange, placeholder?, aria-label? }` | Optional find-in-list filter                                          |
| `itemKeys`                  | `readonly TKey[]`                                | Ordered item keys to render                                           |
| `selectedKeys`              | `readonly TKey[]`                                | Keys checked for bulk toolbar actions                                 |
| `onToggleSelect`            | `(key: TKey) => void`                            | Toggle row selection                                                  |
| `onRemove`                  | `(key: TKey) => void`                            | Remove one row                                                        |
| `renderItem`                | `(ctx) => ReactNode`                             | Row content; receives `dragHandle` for {@link SelectedItemDragHandle} |
| `emptyMessage`              | `string`                                         | Shown when `itemKeys` is empty                                        |
| `maxHeight`                 | `number`                                         | `ScrollArea` max height (default 360)                                 |
| `toolbar`                   | `ReactNode`                                      | Extra actions above the list body (e.g. **Sort channels…**)           |
| `onMoveSelected`            | `(direction: 'up' \| 'down') => void`            | Built-in Move up / Move down                                          |
| `onRemoveSelected`          | `() => void`                                     | Built-in Remove selected                                              |
| `onReorder`                 | `(orderedKeys: TKey[]) => void`                  | Drag-and-drop; receives full `itemKeys` after drop                    |
| `reorderDisabled`           | `boolean`                                        | Disable drag (e.g. while find-in-list filter is active)               |
| `canMoveUp` / `canMoveDown` | `boolean`                                        | Disable edge move buttons (default true)                              |
| `reorderHint`               | `ReactNode`                                      | Override default Alt+↑/↓ / drag hint                                  |
| `enableReorderHotkeys`      | `boolean`                                        | Alt+ArrowUp/Down → `onMoveSelected` (default true when move set)      |

## Usage

```tsx
import { SelectedItemDragHandle, SelectedItemList } from '@app/components/ui/index.ts';

<SelectedItemList
  title="In this zone"
  description="3 members — export order"
  itemKeys={keys}
  selectedKeys={selected}
  onToggleSelect={toggle}
  onRemove={remove}
  onReorder={setKeys}
  reorderDisabled={filterActive}
  onMoveSelected={move}
  onRemoveSelected={removeBulk}
  renderItem={({ itemKey, selected, onToggleSelect, onRemove, dragHandle }) => (
    <MyRow
      key={itemKey}
      dragHandle={<SelectedItemDragHandle dragHandle={dragHandle} />}
      ...
    />
  )}
/>;
```

## Behaviour

- **Reorder mode** — `itemKeys` order is the source of truth; drag + Move up/down mutate it.
- Drag is off when `reorderDisabled` or `onReorder` is absent (decorative grip via `SelectedItemDragHandle` with `null`).
- Prefer disabling drag while a find-in-list filter is active so drops cannot drop filtered-out members.
- Hotkeys listen on `window` while the component is mounted (Alt+Arrow).
- Dense membership property editors stay in `renderItem` (N is typically &lt;100).

## Related

- [SelectedItemDragHandle](./SelectedItemDragHandle.tsx) — grip button
- [AvailableItemPicker](./AvailableItemPicker.md) — paired pool picker (role B)
- [list-kit-roles.md](../../../../docs/features/app-shell/list-kit-roles.md)
- [zone-member-picker.md](../../../../docs/features/library/zone-member-picker.md)
- Dev demos: `/styleguide/membership`
