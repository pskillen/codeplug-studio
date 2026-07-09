# AddFromDataSourceModal

## Purpose

Picker modal for channel import sources — built-in channel sets and external directories — behind one **Add from…** section-nav entry.

## Props

| Prop      | Type         | Description      |
| --------- | ------------ | ---------------- |
| `opened`  | `boolean`    | Modal visibility |
| `onClose` | `() => void` | Close handler    |

## Behaviour

- Renders a `BadgeCard` per entry in `CHANNEL_ADD_SOURCES` (channel set + external directories).
- Card click navigates to the directory route and closes the modal.

## Related

- [`channelDataSources.ts`](../../lib/channelDataSources.ts) — source definitions
- [`BadgeCard`](../ui/BadgeCard.md) — card primitive
