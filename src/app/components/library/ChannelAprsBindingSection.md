## Purpose

Per-channel digital APRS binding editor (`Channel.aprs`) used on the channel editor APRS tab.

## Props

| Prop       | Type                              | Description                                      |
| ---------- | --------------------------------- | ------------------------------------------------ |
| `channels` | `Channel[]`                       | Library channels for report-channel picker       |
| `value`    | `ChannelAprsBinding`              | Current binding values                           |
| `onChange` | `(value: ChannelAprsBinding) => void` | Called when fields change                    |
| `readOnly` | `boolean`                         | When true, shows off-state hint (non-DMR channels) |

## Usage

```tsx
const [aprs, setAprs] = useState(() => channelAprsBindingFromChannel(channel));

<ChannelAprsBindingSection
  channels={library.channels}
  value={aprs}
  onChange={setAprs}
/>
```

## Behaviour

- Maps to `ChannelAprsBinding`: receive, report type (`off` | `digital`), PTT mode, report channel ref.
- Parent `buildRow()` should persist via `normalizeOptionalChannelAprs` so all-off bindings are omitted.
- Tab is shown only when the channel has a DMR mode profile.

## Related

- [APRS feature hub](../../../../docs/features/aprs/README.md)
- `ChannelEditor` — hosts the APRS tab
