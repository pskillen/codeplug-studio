# ChannelCard

Stacked-field card for one channel — name/callsign header, a labeled row per field column, and a delete action. Used where a horizontal table row doesn't fit: the channels list's mobile card layout ([#967](https://github.com/pskillen/codeplug-studio/issues/967)) and its Group by Zone card sections ([#971](https://github.com/pskillen/codeplug-studio/issues/971)).

## Purpose

Avoids duplicating field-rendering logic between the table and the card: callers pass the **same** `DataTableColumn` definitions already built for `ChannelsListPage`'s `DataTable` (band pills, mode pills, RX/TX formatting, zones badges, contact/RX group list/scan list names, …), so the card automatically reflects whichever optional columns are currently visible with zero duplicated field logic.

## Props

| Prop           | Type                         | Notes                                                                                       |
| -------------- | ---------------------------- | ------------------------------------------------------------------------------------------- |
| `channel`      | `Channel`                    | Required                                                                                    |
| `fieldColumns` | `DataTableColumn<Channel>[]` | Rendered as `{col.header}: {col.render(channel)}` rows, in order. Exclude name and actions. |

## Usage

```tsx
import ChannelCard from '@app/components/library/ChannelCard.tsx';

<ChannelCard channel={channel} fieldColumns={visibleOptionalColumns} />;
```

## Behaviour

- Name links to `/library/channels/:id`, matching the table's name-column link.
- No selection checkbox — the card is view/navigate/delete-one only. Bulk select, Bulk edit, and New zone from selection stay desktop-table-only.
- Delete reuses `ChannelListDeleteAction` (row trash icon, same delete-flow confirmation as the table).
- Renders nothing extra when `fieldColumns` is empty (just the name/callsign header + delete).

## Related

- [ChannelsListPage.tsx](../../routes/library/lists/ChannelsListPage.tsx) — mobile `mobileCard` and Group by Zone card sections
- [ChannelListDeleteAction.tsx](./ChannelListDeleteAction.tsx)
- [DataTable.md](../v2/DataTable.md#mobile-card-rows)
- [docs/features/library/README.md](../../../../docs/features/library/README.md#channels-list-24)
