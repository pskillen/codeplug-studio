# FrequencyCurveChart

A value per frequency, one line per level or path, for a debug Calibration tab.

## Purpose

Draws a `FrequencyCurve` view model with [`LineChart`](../LineChart/LineChart.md) (`table={false}`: the card's Numeric table replaces the chart's own). Knows no radio.

## Props

| Prop           | Type             | Notes                                                        |
| -------------- | ---------------- | ------------------------------------------------------------ |
| `chart`        | `FrequencyCurve` | Series, axes, optional fixed `y.domain`                      |
| `overlay`      | `FrequencyCurve` | Same curve from a second read; series pair by `id`           |
| `readLabel`    | `string`         | Appended to each legend entry of the read when overlaid      |
| `overlayLabel` | `string`         | Appended to the overlay's legend entries (default "overlay") |
| `height`       | `number`         | viewBox height, default from `LineChart`                     |

## Usage

```tsx
<FrequencyCurveChart chart={curve} overlay={otherCurve} readLabel="B" overlayLabel="A" />
```

## Behaviour

- Axis titles always carry units: "Drive (PWM counts)", "Frequency (MHz)" (`axisTitle`; a label that already contains its unit is kept).
- The legend is always shown, also for one series.
- Colour follows the series `slot` (meaning), never rank. An overlay series is dashed and takes the slot of the read's series with the same id.
- A point whose `y` is not finite is a missing entry: the line breaks there; an isolated point is drawn as a dot.
- Must render inside `DesignSystemV2Provider` on a debug page.

## Related

- [CalibrationChartCard.md](./CalibrationChartCard.md), [LineChart.md](../LineChart/LineChart.md)
- [Radio debug hub](../../../../docs/features/radio-debug/README.md)
