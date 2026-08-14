# ChannelCard

Stacked-field card for one channel — name/callsign header, optional labeled field rows, optional selection checkbox, and delete action. Used on `/library/channels` when the operator chooses **Cards** layout ([#1205](https://github.com/pskillen/codeplug-studio/issues/1205)).

## Purpose

Avoids duplicating field-rendering logic between the table and cards: callers pass `DataTableColumn` definitions (band pills, mode pills, RX/TX formatting, zones badges, contact/RX group list/scan list names, …) built in `ChannelsListPage`. Card **Show/hide details** uses a separate persisted key from table **Show/hide cols**.

## Props

| Prop                | Type                         | Notes                                                                                       |
| ------------------- | ---------------------------- | ------------------------------------------------------------------------------------------- |
| `channel`           | `Channel`                    | Required                                                                                    |
| `fieldColumns`      | `DataTableColumn<Channel>[]` | Rendered as `{col.header}: {col.render(channel)}` rows. Exclude name, callsign, and actions. |
| `selected`          | `boolean`                    | Optional — paired with `onSelectedChange` for bulk select                                   |
| `onSelectedChange`  | `(selected: boolean) => void`| Optional — when set, shows a row-selection checkbox                                         |

## Usage

```tsx
import ChannelCard from '@app/components/library/ChannelCard.tsx';

<ChannelCard
  channel={channel}
  fieldColumns={visibleCardOptionalColumns}
  selected={selectedKeys.includes(channel.id)}
  onSelectedChange={(selected) => toggleChannelSelected(channel.id, selected)}
/>;
```

## Behaviour

- **Name** links to `/library/channels/:id`, matching the table name column.
- **Callsign** appears below the name when `channel.callsign` is non-empty; omitted entirely when absent (no placeholder row).
- **Selection** — checkbox only when `onSelectedChange` is provided; clicking the checkbox does not navigate.
- **Delete** reuses `ChannelListDeleteAction` (same confirmation flow as the table row action).
- Renders nothing extra when `fieldColumns` is empty (header + delete only).

## Related

- [ChannelsListPage.tsx](../../routes/library/lists/ChannelsListPage.tsx) — table/cards layout, grouping, bulk toolbar
- [ChannelListBulkActions.tsx](./ChannelListBulkActions.tsx)
- [ChannelListDeleteAction.tsx](./ChannelListDeleteAction.tsx)
- [docs/features/library/README.md](../../../../docs/features/library/README.md#channels-list-24)
