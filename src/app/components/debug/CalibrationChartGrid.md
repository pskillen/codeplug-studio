# CalibrationChartGrid

The grid of chart cards at the top of a Calibration tab.

## Purpose

Lays [`CalibrationChartCard`](./CalibrationChartCard.md)s out two to a row, as the UV-5R Mini page did.

## Props

| Prop       | Type        | Notes           |
| ---------- | ----------- | --------------- |
| `children` | `ReactNode` | The chart cards |

## Usage

```tsx
<CalibrationChartGrid>{cards}</CalibrationChartGrid>
```

## Behaviour

- Two equal columns from the `md` breakpoint (62em), one column below; cells can shrink (`minmax(0, 1fr)`), so wide charts never force page scroll.
- Order is the order of the children.

## Related

- [CalibrationChartCard.md](./CalibrationChartCard.md)
- [Radio debug hub](../../../../docs/features/radio-debug/README.md)
