# ChannelZoneMembershipSection

Shows and edits which **zones** include a library channel — direct membership, nested-only visibility, add/remove actions.

## Purpose

Zone membership is owned by `Zone.members`. This section on the channel editor lets operators see cross-links and add or remove the channel from zones without opening each zone editor.

## Props

| Prop        | Type      | Description                     |
| ----------- | --------- | ------------------------------- |
| `channelId` | `string`  | Channel being edited            |
| `library`   | `Library` | Active project library snapshot |

## Usage

```tsx
<FormSection title="Zone membership">
  <ChannelZoneMembershipSection channelId={entity.id} library={library} />
</FormSection>
```

## Behaviour

- Lists direct memberships with **Open zone** and **Remove from zone** (immediate `putZone`).
- Lists parent zones where the channel appears only via nested zones.
- **Add to zone** uses `ZoneSelect` + `addChannelsToZoneMembers`.
- Calls `useLibrary().reload()` after each mutation.

## Related

- [library/README.md](../../../docs/features/library/README.md) · `ZoneMemberEditor`
