# ChannelIdentitySummary

## Purpose

Compact read-only channel identity row for the channel editor. Shows live draft name/callsign, band pill, mode pills, and RX/TX so operators always know which channel they are editing after switching tabs ([#283](https://github.com/pskillen/codeplug-studio/issues/283)).

## Props

| Prop      | Type      | Description                                                        |
| --------- | --------- | ------------------------------------------------------------------ |
| `channel` | `Channel` | Live channel row (typically `buildRow()` from `ChannelEditor`)     |
| `isNew`   | `boolean` | When true, blank identity shows "New channel" instead of UUID text |

## Usage

```tsx
import ChannelIdentitySummary from '@app/components/channels/ChannelIdentitySummary.tsx';

<ChannelIdentitySummary channel={liveChannel} isNew={!entity} />;
```

## Behaviour

- Hidden on the **Identity** tab by `ChannelEditor` — identity fields are already visible there.
- Rendered at the top of each non-identity `Tabs.Panel` (not as a sibling between `Tabs.List` and panels — Mantine ref management requires panel children).
- Label uses `channelDisplayLabel` when callsign or name is set; otherwise "New channel" or "Untitled channel".
- Mode pills mirror the channels list (`channelModesForFilter`, primary marker when multi-mode).
- RX/TX uses `formatChannelRxTxListCell`; omitted when both frequencies are unset.

## Related

- [Library feature hub](../../../docs/features/library/README.md) — channel editor
- [ChannelEditor](../../routes/library/ChannelEditor.tsx)
