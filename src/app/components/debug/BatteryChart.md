# BatteryChart

Battery thresholds as a ladder, highest step on top.

## Purpose

Draws a `BatteryLadder` view model, grown from the UV-5R Mini's battery ladder. Knows no radio: step labels, volts and the erased-ladder text come from the model.

## Props

| Prop           | Type            | Notes                                                        |
| -------------- | --------------- | ------------------------------------------------------------ |
| `chart`        | `BatteryLadder` | Steps (`id`, `label`, `raw`, optional `volts`) and `blank`   |
| `overlay`      | `BatteryLadder` | The same ladder from a second read, drawn as a second column |
| `readLabel`    | `string`        | Column title of the read (shown when overlaid)               |
| `overlayLabel` | `string`        | Column title of the overlay (default "Overlay")              |

## Usage

```tsx
<BatteryChart chart={battery} overlay={otherBattery} readLabel="B" overlayLabel="A" />
```

## Behaviour

- Steps are listed highest first (the model lists them lowest first). A bar per step, scaled to the largest raw value (at least 255), in the read's colour; the overlay column uses the second colour.
- Raw is shown `0x1A (26)` (a raw ADC code), with volts beside it (`, 3.7 V`) when the step has `volts`.
- `blank` replaces the bars with that text (an erased ladder).
- A step with no raw is "Not captured", never zero.
- Must render inside `DesignSystemV2Provider` on a debug page.

## Related

- [CalibrationChartCard.md](./CalibrationChartCard.md)
- [Radio debug hub](../../../../docs/features/radio-debug/README.md)
