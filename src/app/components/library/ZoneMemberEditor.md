# ZoneMemberEditor

Contributor sidecar for `ZoneMemberEditor.tsx` — zone membership on the mk2 **Membership** family.

## Purpose

Manages zone membership using `MembershipPanel` + `MembershipRow` (role C) and `AddMembersScreen` + `MembershipPoolRow` (role B). Supports direct channels, nested zones, reorder, and per-channel `includeInScanList` in a dedicated **Scanning behaviour** panel (not on member rows).

## Props

| Prop                 | Type                | Description                                                   |
| -------------------- | ------------------- | ------------------------------------------------------------- |
| `channels`           | `Channel[]`         | Full library channels                                         |
| `zones`              | `Zone[]`            | Full library zones                                            |
| `editingZoneId`      | `string \| null`    | Zone being edited (`null` on create)                          |
| `members`            | `ZoneMemberEntry[]` | Current member list                                           |
| `onChange`           | `(members) => void` | Member list updates                                           |
| `onMapFiltersChange` | optional            | Map hide-filter callback                                      |
| `mode`               | optional            | `members`, `scanning`, `summary`, `full` (default), `pool`    |
| `onAdd`              | optional            | When set, member panel shows **Add members** (overlay in parent) |

## Usage

```tsx
<ZoneMemberEditor
  channels={library.channels}
  zones={library.zones}
  editingZoneId={zone.id}
  members={members}
  onChange={setMembers}
  mode="members"
  onAdd={() => setAddOpen(true)}
/>
<ZoneMemberAddOverlay open={addOpen} zoneName={zone.name} ... />
```

## Behaviour

- **`members`:** `MembershipPanel` with find-in-list, Sort channels…, bulk move/remove, drag reorder (`DataTableBulkReorderProvider`). Scan controls are **not** on rows.
- **`scanning`:** Lighter list for the Scanning behaviour panel — Auto / Force / Skip per direct channel member.
- **`full`:** Create flow — members panel + inline pool (no `onAdd`).
- **`pool`:** Legacy shim — inline pool only.
- Blocked nested zones in the add pool use `MembershipPoolRow` `disabled` + `reason`.
- Map filters via `computeZoneMemberPickerMapFilters`.

## Related

- [zone-member-picker.md](../../../docs/features/library/zone-member-picker.md) · [nested-zones.md](../../../docs/features/library/nested-zones.md)
- [MembershipPanel.md](../v2/MembershipPanel.md) · [AddMembersScreen.md](../v2/AddMembersScreen.md)
