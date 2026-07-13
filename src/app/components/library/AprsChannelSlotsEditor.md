## Purpose

Editable list of digital APRS channel slots on an `AprsConfiguration`. Each slot binds a library channel (or “current channel”), optional DMR timeslot, target DMR ID, and call type.

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

- **Current channel** maps to `channelRef: null` (Anytone wire `0`).
- No radio-specific slot cap in the UI; export warnings handle profile limits.
- Slots can be added or removed in any order; slot index at export is list order.

## Related

- [APRS feature hub](../../../../docs/features/aprs/README.md)
- `AprsConfigurationEditor` — parent form
