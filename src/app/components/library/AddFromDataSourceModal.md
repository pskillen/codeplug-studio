# AddFromDataSourceModal

## Purpose

Picker modal for channel import sources — built-in channel sets and external directories — behind one **Add from…** section-nav entry.

## Props

| Prop      | Type                           | Description                                 |
| --------- | ------------------------------ | ------------------------------------------- |
| `opened`  | `boolean`                      | Modal visibility                            |
| `onClose` | `() => void`                   | Close handler                               |
| `sources` | `readonly AddFromDataSource[]` | Optional; defaults to `CHANNEL_ADD_SOURCES` |

## Behaviour

- Renders a responsive card grid inside v2 `ModalShell` (one card per `sources` entry).
- Card click navigates to the directory route and closes the modal.

## Related

- [`channelDataSources.ts`](../../lib/channelDataSources.ts) — source definitions
- [`ModalShell`](../v2/ModalShell.md) — overlay chrome
