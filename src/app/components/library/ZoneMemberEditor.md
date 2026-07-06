# ZoneMemberEditor

Contributor sidecar for `ZoneMemberEditor.tsx` — vertical stacked zone membership editor on the zone form.

## Purpose

Manages **In this zone** members (export order) and **Other channels & zones** add pool in a single-column layout. Supports direct channels, nested zones, reorder, per-channel `includeInScanList`, and map filter integration.

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `channels` | `Channel[]` | Full library channels |
| `zones` | `Zone[]` | Full library zones |
| `editingZoneId` | `string \| null` | Zone being edited (`null` on create) |
| `members` | `ZoneMemberEntry[]` | Current member list |
| `onChange` | `(members) => void` | Member list updates |
| `onMapFiltersChange` | optional | Map hide-filter callback |

## Usage

```tsx
<ZoneMemberEditor
  channels={library.channels}
  zones={library.zones}
  editingZoneId={zone.id}
  members={members}
  onChange={setMembers}
  onMapFiltersChange={setMapFilters}
/>
```

## Behaviour

- **In this zone:** rich channel rows (freq, mode pills, scan skip badge, scan-list checkbox), nested zone rows with effective counts, move up/down, Alt+↑/↓, remove per-row or bulk.
- **Other channels & zones:** filter, multi-select add, hide-from-map checkboxes.
- Map filters via `computeZoneMemberPickerMapFilters` in `zoneMemberPickerUtils.ts`.

## Related

- [zone-member-picker.md](../../../docs/features/library/zone-member-picker.md) · [nested-zones.md](../../../docs/features/library/nested-zones.md)
