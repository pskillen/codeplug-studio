# ZoneMemberPicker

Contributor sidecar for `ZoneMemberPicker.tsx` — two-list zone membership editor (channels and nested zones).

## Purpose

Edits ordered `Zone.members` on the zone form: available ↔ in-zone shuttle for **channels** and **zones**, with per-side search, map filter hooks, and move up/down.

## Props

| Prop                 | Type                | Description                                                          |
| -------------------- | ------------------- | -------------------------------------------------------------------- |
| `channels`           | `Channel[]`         | Library channel pool                                                 |
| `zones`              | `Zone[]`            | Library zone pool (for nested membership)                            |
| `editingZoneId`      | `string \| null`    | Current zone id — blocks self, descendants, and cycle-closers in the available pool (greyed + labelled) |
| `members`            | `ZoneMemberEntry[]` | Current membership (controlled)                                      |
| `onChange`           | `(members) => void` | Updated membership in export order                                   |
| `onMapFiltersChange` | optional            | Map preview filter callback                                          |

## Usage

```tsx
<ZoneMemberPicker
  channels={library.channels}
  zones={library.zones}
  editingZoneId={zone.id}
  members={members}
  onChange={setMembers}
  onMapFiltersChange={setMapFilters}
/>
```

## Behaviour

- **Available channels** — sorted by name; filtered by search; excludes channels already in zone.
- **Available zones** — sorted by name; excludes zones already in zone. Self, descendants, and cycle-closing candidates remain **visible but greyed** with a reason label and cannot be added (see [ZoneMemberEditor](./ZoneMemberEditor.md)).
- **In zone** — mixed channel and zone rows; order is export order for zone-capable builds.
- Map integration via `computeZoneMemberPickerMapFilters` — see [zone-member-picker.md](../../../docs/features/library/zone-member-picker.md).

## Related

- [zone-member-picker.md](../../../docs/features/library/zone-member-picker.md)
- [nested-zones.md](../../../docs/features/library/nested-zones.md)
