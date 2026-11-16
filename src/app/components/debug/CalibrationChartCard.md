# CalibrationChartCard

One calibration chart in its container, by chart `kind`.

## Purpose

The card every Calibration chart sits in, on every radio. Built on [`DebugSection`](./DebugSection.md). Knows no radio: text, addresses and units come from the chart view model.

## Props

| Prop           | Type               | Notes                                                                       |
| -------------- | ------------------ | --------------------------------------------------------------------------- |
| `chart`        | `CalibrationChart` | Any chart; see Behaviour for the kinds drawn                                |
| `overlay`      | `CalibrationChart` | The same chart (same id) from the overlay read; ignored if its kind differs |
| `readLabel`    | `string`           | Names the read in legends and the Numeric table                             |
| `overlayLabel` | `string`           | Names the overlay                                                           |

Exports: `CARD_CHART_KINDS`, `DISCRETE_NOTE`.

## Usage

```tsx
<CalibrationChartGrid>
  {charts.map((c) => (
    <CalibrationChartCard key={c.id} chart={c} overlay={overlayById.get(c.id)} />
  ))}
</CalibrationChartGrid>
```

## Behaviour

- Title row: title, address as code, layout and meaning `ConfidenceBadge`s, and with an overlay a diff badge, "same in both" or "N values differ" (count of numbers that differ between the two Numeric tables; columns pair by id, rows by index).
- One-line `meaning` under the title.
- Folds: **About this chart** (the chart's `about`, plus "Lines join neighbouring entries as a guide only." when a frequency curve is `discrete`; absent when there is nothing to say) and **Numeric table** (`NumericTable`, built only when opened).
- Kinds drawn: `frequency-curve` ([FrequencyCurveChart](./FrequencyCurveChart.md)) and `step-bars` ([StepBarChart](./StepBarChart.md)). `battery` and `trim` render nothing until part 2b adds `BatteryChart` and `TrimDisplay`.

## Related

- [CalibrationChartGrid.md](./CalibrationChartGrid.md), [NumericTable.md](./NumericTable.md)
- [Radio debug hub](../../../../docs/features/radio-debug/README.md)
