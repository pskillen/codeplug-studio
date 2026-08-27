# BulkZonePickerColumn

Independent zone picker column for bulk add/remove: search, add a zone to the box, remove it from the box.

## Purpose

Used as a pair in `ChannelBulkEditModal` (**Remove from** / **Add to**). Not a classic available↔selected shuttle — each column has its own search and selected box. A zone must not appear in both columns; the parent passes the other column’s ids as `blockedIds`.

## Props

| Prop                 | Type                         | Description                                              |
| -------------------- | ---------------------------- | -------------------------------------------------------- |
| `title`              | `string`                     | Column heading                                           |
| `description`        | `string` (optional)          | Short hint under the heading                             |
| `searchPlaceholder`  | `string` (optional)          | Select placeholder                                       |
| `zones`              | `readonly Zone[]`            | Library zones (display labels from `name`, keys from `id`) |
| `selectedIds`        | `readonly string[]`          | Zone ids currently in this column’s box                  |
| `onSelectedIdsChange`| `(ids: string[]) => void`    | Replace this column’s selection                          |
| `blockedIds`         | `readonly string[]` (optional) | Zone ids already in the other column                   |
| `emptyMessage`       | `string` (optional)          | Shown when the project has no zones                      |

## Usage

```tsx
<div className={classes.pairRow}>
  <BulkZonePickerColumn
    title="Remove from"
    zones={library.zones}
    selectedIds={removeZoneIds}
    blockedIds={addZoneIds}
    onSelectedIdsChange={setRemoveZoneIds}
  />
  <BulkZonePickerColumn
    title="Add to"
    zones={library.zones}
    selectedIds={addZoneIds}
    blockedIds={removeZoneIds}
    onSelectedIdsChange={setAddZoneIds}
  />
</div>
```

## Behaviour

- Search is per column. Choosing a zone from the searchable select **adds** it to this box and clears the select.
- Pills in the box have a remove control; that only takes the zone out of this Apply list.
- Blocked ids are omitted from the dropdown so a zone cannot sit in both boxes.
- Apply (parent) writes **direct** UUID membership via `addChannelsToZoneMembers` / `removeChannelsFromZoneMembers`. Nested-only membership is not edited here.

## Related

- [`ChannelBulkEditModal`](./ChannelBulkEditModal.md)
- [library hub](../../../docs/features/library/README.md)
- [`ChannelZoneMembershipSection`](./ChannelZoneMembershipSection.md)
