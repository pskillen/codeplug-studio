# AvailableItemPicker

## Purpose

Scrollable **pool** picker (role **B**) with one or more labelled sections, optional filter/description, checkboxes per row, section toolbar slot, and an add-selected action. Pairs with [`SelectedItemList`](./SelectedItemList.md) for membership editors.

## Props

| Prop            | Type                                             | Description                                  |
| --------------- | ------------------------------------------------ | -------------------------------------------- |
| `title`         | `ReactNode`                                      | Panel heading                                |
| `description`   | `ReactNode`                                      | Optional subtitle / counts                   |
| `filter`        | `{ value, onChange, placeholder?, aria-label? }` | Optional pool filter                         |
| `sections`      | `AvailableItemPickerSection[]`                   | Grouped pools (e.g. Channels / Zones)        |
| `maxHeight`     | `number`                                         | `ScrollArea` max height (default 280)        |
| `addLabel`      | `string`                                         | Add button label (default `Add selected`)    |
| `onAddSelected` | `() => void`                                     | Add checked rows to the selected list        |
| `addDisabled`   | `boolean`                                        | Disable add button                           |
| `footer`        | `ReactNode`                                      | Extra controls beside add (e.g. map toggles) |

### `AvailableItemPickerSection`

| Field            | Type                  | Description                                                  |
| ---------------- | --------------------- | ------------------------------------------------------------ |
| `id`             | `string`              | React key                                                    |
| `title`          | `string`              | Section heading (uppercase)                                  |
| `itemKeys`       | `readonly TKey[]`     | Available row keys                                           |
| `selectedKeys`   | `readonly TKey[]`     | Checked keys in this section                                 |
| `onToggleSelect` | `(key: TKey) => void` | Toggle one checkbox                                          |
| `renderItem`     | `(ctx) => ReactNode`  | Sparse row content                                           |
| `emptyMessage`   | `string`              | Empty section message                                        |
| `sectionToolbar` | `ReactNode`           | Optional actions beside the section title (Select all, etc.) |

## Usage

```tsx
import { AvailableItemPicker } from '@app/components/ui/index.ts';

<AvailableItemPicker
  title="Available"
  description="Stage candidates to add"
  filter={{ value: q, onChange: setQ }}
  sections={[
    {
      id: 'channels',
      title: 'Channels',
      itemKeys: channelIds,
      selectedKeys: pickedChannels,
      onToggleSelect: toggleChannel,
      sectionToolbar: <Button size="compact-xs">Select all</Button>,
      renderItem: ({ itemKey, checked, onToggle }) => <ChannelRow ... />,
    },
  ]}
  onAddSelected={addPicked}
  addDisabled={!pickedCount}
/>;
```

## Behaviour

- Selection means “stage for add”, not bulk-edit the entity.
- Keep rows sparse — no edit/delete/reorder of candidates here.

## Related

- [SelectedItemList](./SelectedItemList.md)
- [list-kit-roles.md](../../../../docs/features/app-shell/list-kit-roles.md)
- [zone-member-picker.md](../../../../docs/features/library/zone-member-picker.md)
- Dev demos: `/styleguide/membership`
