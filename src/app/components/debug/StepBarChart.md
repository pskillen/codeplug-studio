# StepBarChart

Bars per step: squelch levels, S-meter steps, per-frequency offsets.

## Purpose

Draws a `StepBars` view model as inline SVG, grown from the UV-5R Mini's `ByteBars`. Knows no radio.

## Props

| Prop           | Type       | Notes                                                    |
| -------------- | ---------- | -------------------------------------------------------- |
| `chart`        | `StepBars` | Bars (`id`, `label`, `value`), axes, `y.domain`          |
| `overlay`      | `StepBars` | Same bars from a second read; pair by bar `id`           |
| `readLabel`    | `string`   | Prefix of the read's bar tooltips when overlaid          |
| `overlayLabel` | `string`   | Prefix of the overlay's bar tooltips (default "overlay") |

## Usage

```tsx
<StepBarChart chart={squelch} overlay={otherSquelch} overlayLabel="A" />
```

## Behaviour

- `y.domain` `'auto'` (or unset) scales 0 to the data's top tick, including the overlay's values, and shows "scale 0–N" under the chart so small offsets are readable. A `[lo, hi]` pair is used as given, with no note.
- Overlay bars are outlined, drawn beside the filled bar of the same id.
- Bar labels come from the model; with many bars only every nth label is drawn.
- A bar with no value is drawn as a dash ("Not captured" in its tooltip), never as zero.
- `stepBarDomain(chart, overlay)` is exported for tests.
- Must render inside `DesignSystemV2Provider` on a debug page.

## Related

- [CalibrationChartCard.md](./CalibrationChartCard.md)
- [Radio debug hub](../../../../docs/features/radio-debug/README.md)
