# SelectedItemRowMoveButtons

## Purpose

Per-row up/down `ActionIcon`s for role **C** membership lists. Complements drag handles and toolbar **Move up** / **Move down** (selection).

## Props

| Prop        | Type                               | Description                                        |
| ----------- | ---------------------------------- | -------------------------------------------------- |
| `rowMove`   | `SelectedItemRowMoveProps \| null` | From `SelectedItemList` `renderItem`; `null` hides |
| `upLabel`   | `string` (optional)                | Aria label (default **Move up**)                   |
| `downLabel` | `string` (optional)                | Aria label (default **Move down**)                 |

## Usage

```tsx
import { SelectedItemList, SelectedItemRowMoveButtons } from '@app/components/ui/index.ts';

<SelectedItemList
  onMoveItem={(key, direction) => moveOne(key, direction)}
  renderItem={({ itemKey, rowMove }) => (
    <Group key={itemKey}>
      <Text>{itemKey}</Text>
      <SelectedItemRowMoveButtons rowMove={rowMove} />
    </Group>
  )}
/>;
```

## Behaviour

- Disabled at list edges (`canMoveUp` / `canMoveDown`).
- Clicks stop propagation so parent row click handlers do not fire.
- Renders nothing when `rowMove` is null (e.g. `onMoveItem` unset or `reorderDisabled`).

## Related

- [SelectedItemList.md](./SelectedItemList.md)
- [lists-and-ordering.md](../../../../docs/reference/styleguide/lists-and-ordering.md)
- Gold: Build → Zones → Members tab (`ZoneMemberOrderSection`)
