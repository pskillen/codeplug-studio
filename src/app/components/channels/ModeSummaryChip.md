# ModeSummaryChip

## Purpose

One channel mode shown as a neutral chip: coloured mode label plus a one-line library-value summary in monospace. Used wherever lists show how to reach each mode, not just which modes are present.

## Props

| Prop      | Type                 | Default | Description                                                         |
| --------- | -------------------- | ------- | ------------------------------------------------------------------- |
| `summary` | `ChannelModeSummary` | —       | Label, detail text, and main-mode flag from `channelModeSummary.ts` |
| `size`    | `'xs' \| 'sm'`       | `'sm'`  | `xs` ≈20px tall for tables; `sm` ≈24px                              |

## Usage

```tsx
import ModeSummaryChip from '@app/components/channels/ModeSummaryChip.tsx';
import { channelModeSummaries } from '@app/lib/channelModeSummary.ts';

const [summary] = channelModeSummaries(channel, library);
<ModeSummaryChip summary={summary} size="xs" />;
```

## Behaviour

- Mode label sits on the mode colour; detail ellipsises when space is tight; empty detail shows the label only.
- `isMain` on the summary draws a 2px border in the mode colour and adds a visually hidden “ (main mode)”.
- `title` carries the full label + detail (+ “main mode” when applicable).

## Related

- [Library feature hub — channel modes](../../../docs/features/library/channel-modes.md)
- [`channelModeSummary.ts`](../../lib/channelModeSummary.ts)
- [Styleguide — Mode summaries](../../../docs/reference/styleguide/display.md#mode-summaries)
