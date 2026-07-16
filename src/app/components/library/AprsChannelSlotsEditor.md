## Purpose

Editable list of digital APRS channel slots on an `AprsConfiguration`. Slots are shown in a read-only `DataTable`; add and edit use a compact modal form.

## Props

| Prop       | Type                                 | Description                          |
| ---------- | ------------------------------------ | ------------------------------------ |
| `channels` | `Channel[]`                          | Library channels for the slot picker |
| `slots`    | `AprsChannelSlot[]`                  | Current slot rows                    |
| `onChange` | `(slots: AprsChannelSlot[]) => void` | Called when slots are edited         |

## Usage

```tsx
<AprsChannelSlotsEditor
  channels={library.channels}
  slots={channelSlots}
  onChange={setChannelSlots}
/>
```

## Behaviour

- **Current channel** maps to `channelRef: null`.
- Default table sort is **slot number ascending** (1-based index).
- Channel picker groups options by Anytone export bank: **DMR / main bank**, **AM air**, **FM broadcast** (see `aprsSlotChannelSelectGroups`).
- Analog receive-bank channels are valid slot bindings; Anytone export resolves `APRS.CSV` `channelN` from the matching bank `No.` column.
- No radio-specific slot cap in the UI; export warnings handle profile limits.

## Related

- [APRS feature hub](../../../../docs/features/aprs/README.md)
- `AprsConfigurationEditor` — parent form
- `AprsChannelSlotModal` — add/edit modal
