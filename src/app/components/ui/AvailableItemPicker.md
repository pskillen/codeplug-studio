# AvailableItemPicker

## Purpose

Scrollable **pool** picker with one or more labelled sections, optional filter, checkboxes per row, and an add-selected action. Pairs with [`SelectedItemList`](./SelectedItemList.md) for membership editors.

## Props

| Prop            | Type                                             | Description                                  |
| --------------- | ------------------------------------------------ | -------------------------------------------- |
| `title`         | `ReactNode`                                      | Panel heading                                |
| `filter`        | `{ value, onChange, placeholder?, aria-label? }` | Optional filter field                        |
| `sections`      | `AvailableItemPickerSection[]`                   | Grouped pools (e.g. Channels / Zones)        |
| `maxHeight`     | `number`                                         | `ScrollArea` max height (default 280)        |
| `addLabel`      | `string`                                         | Add button label (default `Add selected`)    |
| `onAddSelected` | `() => void`                                     | Add checked rows to the selected list        |
| `addDisabled`   | `boolean`                                        | Disable add button                           |
| `footer`        | `ReactNode`                                      | Extra controls beside add (e.g. map toggles) |

### `AvailableItemPickerSection`

| Field            | Type                  | Description                  |
| ---------------- | --------------------- | ---------------------------- |
| `id`             | `string`              | React key                    |
| `title`          | `string`              | Section heading (uppercase)  |
| `itemKeys`       | `readonly TKey[]`     | Available row keys           |
| `selectedKeys`   | `readonly TKey[]`     | Checked keys in this section |
| `onToggleSelect` | `(key: TKey) => void` | Toggle one checkbox          |
| `renderItem`     | `(ctx) => ReactNode`  | Row content                  |
| `emptyMessage`   | `string`              | Empty section message        |

## Usage

```tsx
import { AvailableItemPicker } from '@app/components/ui/index.ts';

<AvailableItemPicker
  title="Available"
  filter={{ value: q, onChange: setQ }}
  sections={[
    {
      id: 'channels',
      title: 'Channels',
      itemKeys: channelIds,
      selectedKeys: pickedChannels,
      onToggleSelect: toggleChannel,
      renderItem: ({ itemKey, checked, onToggle }) => <ChannelRow ... />,
    },
  ]}
  onAddSelected={addPicked}
  addDisabled={!pickedCount}
/>;
```

## Related

- [SelectedItemList](./SelectedItemList.md)
- [zone-member-picker.md](../../../../docs/features/library/zone-member-picker.md)
- Dev demos: `/styleguide`
