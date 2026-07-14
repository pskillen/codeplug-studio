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

- Lists library channels with inline editors for report type, report slot, receive, and PTT mode.
- **Channel type** filter (`Digital` | `Analog` | `Both`) on the search row — digital = DMR profile; analog = no DMR profile.
- **Band** multi-select filter and **Band** column (`BandPill` from RX/TX frequencies).
- Toolbar filters: report slot, report type, receive; labelled **Search** field filters name/callsign on the same row as channel type.
- **Bulk set…** opens [AprsChannelBulkAssignModal](./AprsChannelBulkAssignModal.tsx) for selected rows.
- **Save assignments** persists dirty `Channel.aprs` bindings via `persistence.putChannel`.
- Slot labels and list column text use [aprsBindingHelpers](../../lib/aprsBindingHelpers.ts).

## Related

- [APRS feature hub](../../../../docs/features/aprs/README.md)
- [Channels list APRS column](../../../../docs/features/aprs/README.md#editing-paths)
