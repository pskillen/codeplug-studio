# TrimDisplay

A trim value on its scale.

## Purpose

Draws a `TrimView`, grown from the UV-5R Mini's trim gauge ("not really a slider"). Knows no radio: scale, ppm step and the out-of-range text come from the model.

## Props

| Prop           | Type       | Notes                                                   |
| -------------- | ---------- | ------------------------------------------------------- |
| `chart`        | `TrimView` | `raw`, `scale` (min, max, neutral), `ppm`, `outOfRange` |
| `overlay`      | `TrimView` | The same trim from a second read, a hollow marker       |
| `readLabel`    | `string`   | Names the read when overlaid (default "Read")           |
| `overlayLabel` | `string`   | Names the overlay (default "Overlay")                   |

Exports: `trimPpm(chart, raw)`, `trimValueText(chart, raw)`.

## Usage

```tsx
<TrimDisplay chart={trim} overlay={otherTrim} readLabel="B" overlayLabel="A" />
```

## Behaviour

- With `ppm`: a centre-zero ppm scale with a tick per whole ppm over `ppm.span` (else the scale's own reach). ppm = (raw - neutral) x `perStep`; neutral is `scale.neutral`, else the scale's midpoint. Value line `0x0C (12), +2 ppm`.
- Without `ppm`: a raw-scale bar from `scale.min` to `scale.max`, labelled "ppm scale unknown", with a neutral tick when `scale.neutral` is set. Value line is raw only.
- A value off the scale draws no marker; `outOfRange` text shows under the display, or "Off scale" when the model has none.
- A missing raw reads "Not captured" and draws no marker.
- Must render inside `DesignSystemV2Provider` on a debug page.

## Related

- [CalibrationChartCard.md](./CalibrationChartCard.md)
- [Radio debug hub](../../../../docs/features/radio-debug/README.md)
