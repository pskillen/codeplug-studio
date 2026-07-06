# AddChannelsToZoneModal

Modal for adding library channels or nested zones to a zone on the unified channels-and-zones screen.

## Purpose

Replaces the two-list `ZoneMemberPicker` shuttle for membership changes. Operators search and filter the channel pool, multi-select rows, and append to the active zone's `members` list.

## Props

| Prop | Type | Notes |
| --- | --- | --- |
| `opened` | `boolean` | Modal visibility |
| `onClose` | `() => void` | Close handler |
| `library` | `Library` | Active project library |
| `targetZone` | `Zone \| null` | Active zone; when `null`, shows zone picker (orphans flow) |
| `onAdded?` | `() => void` | Called after successful `putZone` |

## Usage

```tsx
<AddChannelsToZoneModal
  opened={addModalOpen}
  onClose={() => setAddModalOpen(false)}
  library={library}
  targetZone={activeZone}
/>
```

## Behaviour

- **Channels** tab: membership filter (Any / Not in zone / In zone), list filters via `useChannelListQuery`, multi-select, **Add N channels**.
- **Nested zones** tab: searchable zone list excluding self, descendants, and already-member zones; cycle check on save via `validateZoneMembership`.
- Quick links: new channel, channel set, ukrepeater, BrandMeister (navigate away; return via browser back).

## Related

- [zone-pivoted-ui.md](../../../../docs/features/library/zone-pivoted-ui.md) (when shipped)
- [library README](../../../../docs/features/library/README.md)
