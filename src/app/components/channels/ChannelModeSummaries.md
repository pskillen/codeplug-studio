# ChannelModeSummaries

## Purpose

Renders every mode on a channel as a row of `ModeSummaryChip` components, in main-first order when the channel has two or more modes.

## Props

| Prop         | Type                | Default | Description                                           |
| ------------ | ------------------- | ------- | ----------------------------------------------------- |
| `channel`    | `Pick<Channel, …>`  | —       | `modeProfiles` and `primaryMode`                      |
| `lookup`     | `ModeSummaryLookup` | —       | Talk groups and digital contacts for TG/PC summaries  |
| `layout`     | `'wrap' \| 'line'`  | —       | `wrap` for table/card cells; `line` for tight headers |
| `maxVisible` | `number`            | —       | With `layout="line"`, overflow becomes a `+N` chip    |
| `size`       | `'xs' \| 'sm'`      | `'sm'`  | Passed through to each chip                           |

## Usage

```tsx
import ChannelModeSummaries from '@app/components/channels/ChannelModeSummaries.tsx';

<ChannelModeSummaries channel={ch} lookup={library} layout="wrap" size="xs" />;
```

## Behaviour

- Returns `null` when the channel has no mode profiles (differs from the mode filter, which still treats bare channels as FM for filtering).
- Main mode is first when multi-mode; remaining modes follow library profile order.
- `+N` chip `title` lists the hidden summaries.

## Related

- [`channelModeSummary.ts`](../../lib/channelModeSummary.ts)
- [ModeSummaryChip.md](ModeSummaryChip.md)
- [Styleguide — Mode summaries](../../../docs/reference/styleguide/display.md#mode-summaries)
