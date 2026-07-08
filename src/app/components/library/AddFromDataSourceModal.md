# AddFromDataSourceModal

## Purpose

Picker modal for external channel directories — replaces three long section-nav buttons with one **Add from…** entry point.

## Props

| Prop      | Type         | Description      |
| --------- | ------------ | ---------------- |
| `opened`  | `boolean`    | Modal visibility |
| `onClose` | `() => void` | Close handler    |

## Behaviour

- Renders a `BadgeCard` per entry in `CHANNEL_DATA_SOURCES`.
- Card click navigates to the directory route and closes the modal.

## Related

- [`channelDataSources.ts`](../../lib/channelDataSources.ts) — source definitions
- [`BadgeCard`](../ui/BadgeCard.md) — card primitive
