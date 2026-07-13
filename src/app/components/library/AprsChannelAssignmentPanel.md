## Purpose

Bulk channel APRS assignment table on the singleton APRS configuration page (**Channel assignments** tab). Complements per-channel [ChannelAprsBindingSection](./ChannelAprsBindingSection.md) on the channel editor.

## Props

| Prop                | Type                             | Description                                   |
| ------------------- | -------------------------------- | --------------------------------------------- |
| `projectId`         | `string`                         | Active project (reserved for future prefs)    |
| `channels`          | `Channel[]`                      | Full library channel list                     |
| `aprsConfiguration` | `AprsConfiguration \| null`      | Singleton library APRS config                 |
| `channelSlots`      | `AprsChannelSlot[]`              | Slot rows used for pickers and summary labels |
| `onSaved`           | `() => Promise<void>` (optional) | Called after successful channel persistence   |

## Usage

Mounted from [AprsConfigurationPage](../../routes/library/AprsConfigurationPage.tsx) on the assignments tab.

## Behaviour

- Lists **DMR channels only** with inline editors for report type, report slot, receive, and PTT mode.
- Toolbar filters: report slot, report type, receive; `DataTable` search on name/callsign.
- **Bulk set…** opens [AprsChannelBulkAssignModal](./AprsChannelBulkAssignModal.tsx) for selected rows.
- **Save assignments** persists dirty `Channel.aprs` bindings via `persistence.putChannel`.
- Slot labels and list column text use [aprsBindingHelpers](../../lib/aprsBindingHelpers.ts).

## Related

- [APRS feature hub](../../../../docs/features/aprs/README.md)
- [Channels list APRS column](../../../../docs/features/aprs/README.md#editing-paths)
