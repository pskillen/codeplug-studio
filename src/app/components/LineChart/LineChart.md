# LineChart

A small inline-SVG line chart with no chart library: one x and one y axis, 2px lines, an optional dashed line style
for a second source, a legend, a hover crosshair with a tooltip, and a table view.

## Purpose

Studio has no chart dependency. Debug and reference pages that need a plain line chart (the
[UV-5R Mini calibration viewer](../../../../docs/features/debug/uv5r-mini-full-read.md#calibration-viewer)'s PA bias
curves) draw it with this component.

## Props

| Prop      | Type                        | Default             | Notes                                                                                                           |
| --------- | --------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------- |
| `title`   | `string`                    | required            | Accessible name of the SVG (`role="img"`) and the table view's caption                                          |
| `series`  | `LineChartSeries[]`         | required            | `{ id, label, slot, dashed?, points: { x, y }[] }`. `slot` is a categorical colour slot (0-based), not a colour |
| `xLabel`  | `string`                    | required            | Axis title and the table's first column                                                                         |
| `yLabel`  | `string`                    | required            | Axis title                                                                                                      |
| `formatX` | `(x: number) => string`     | `String`            | Tick, tooltip and table text                                                                                    |
| `formatY` | `(y: number) => string`     | `String`            | Tick, tooltip and table text                                                                                    |
| `yDomain` | `readonly [number, number]` | data range, rounded | Fix the y range (for example to compare charts)                                                                 |
| `height`  | `number`                    | `240`               | viewBox height; the width is 560 and the SVG scales down to its container                                       |

`lineChartScale.ts` exports `lineChartSlotColor(slot, scheme)`, which returns a slot's light or dark step; `niceTicks(lo, hi, count)` the rounded ticks.

## Usage

```tsx
import LineChart from '@app/components/LineChart/LineChart.tsx';

<LineChart
  title="PA bias, segment 1"
  xLabel="MHz"
  yLabel="Byte"
  series={[
    {
      id: 'a0',
      label: 'Level 0 (A)',
      slot: 0,
      points: [
        { x: 130, y: 10 },
        { x: 133, y: 12 },
      ],
    },
    {
      id: 'b0',
      label: 'Level 0 (B)',
      slot: 0,
      dashed: true,
      points: [
        { x: 130, y: 11 },
        { x: 133, y: 12 },
      ],
    },
  ]}
/>;
```

## Behaviour

- Colours come from fixed categorical slots (blue, orange, aqua, …), with separate light and dark steps picked from
  Mantine's computed colour scheme. A series keeps its slot: the caller ties the slot to the entity (a power level),
  never to its rank. Two sources of the same entity share the slot and differ by line style (solid and dashed).
- The legend shows when there are two or more series. Text, ticks and grid use Mantine's text, dimmed and border
  tokens, never the series colour.
- Hovering the plot snaps a crosshair to the nearest x and lists every series' value there.
- A collapsed **Table** under the chart lists every x with each series' value, for screen readers and for the slots
  whose contrast against the light surface is under 3:1.

## Related

- [UV-5R Mini full read](../../../../docs/features/debug/uv5r-mini-full-read.md)
