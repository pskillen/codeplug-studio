# PercentLevelSlider

## Purpose

Slider for power and analog squelch with an optional **Radio default** checkbox. The ordinary scale is 0–100. Power editing can add a named endpoint after 100.

## Props

| Prop                   | Type                                          | Description                                                                                                  |
| ---------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `label`                | `string`                                      | Field title                                                                                                  |
| `value`                | `number \| null`                              | Percent, the extra endpoint, or `null` for radio default                                                     |
| `onChange`             | `(value: number \| null) => void`             | Slider or default-checkbox handler                                                                           |
| `zeroLabel`            | `string` (optional)                           | Label for `0` (e.g. Open (0%) on squelch)                                                                    |
| `defaultLabel`         | `string` (optional)                           | Checkbox label. Default **Radio default**                                                                    |
| `description`          | `string` (optional)                           | Help under the title                                                                                         |
| `min` / `max` / `step` | `number` (optional)                           | Range. Default 0–100, step 5                                                                                 |
| `extraEndpoint`        | `{ value: number; label: string }` (optional) | Extends the track beyond the ordinary maximum and names the final value in the visible and accessible labels |
| `showValue`            | `boolean` (optional)                          | When false, omit `— {value}` and hide the primary thumb and bar. Default: hide only when `value` is `null`   |
| `showDefaultCheckbox`  | `boolean` (optional)                          | Default true. Set false when a parent gradient owns **Default**                                              |
| `previewValues`        | `(number \| null)[]` (optional)               | Bulk-selection percents drawn as outline dots on the track. Null (radio default) is marked at 50%            |

## Usage

```tsx
import { CHANNEL_POWER_ABOVE_HIGH } from '@core/models/library.ts';

const extraEndpoint = { value: CHANNEL_POWER_ABOVE_HIGH, label: 'Above High' };

<PercentLevelSlider
  label="Power"
  value={form.power}
  onChange={(power) => setForm((prev) => ({ ...prev, changePower: true, power }))}
  min={1}
  step={1}
  extraEndpoint={extraEndpoint}
  showValue={form.changePower && form.power != null}
  showDefaultCheckbox={false}
  previewValues={channels.map((channel) => channel.power)}
/>;
```

## Behaviour

- **Radio default** (`value == null`) or `showValue={false}`: no `— 50%` (or **Radio default**) suffix, and the primary thumb and filled bar are hidden (the slider parks at `min` so it does not sit at 50%). The track and marks stay visible.
- Power shows a 100 mark and a final **Above High** position. Right moves from 99 to 100 to Above High. Left returns to 100. Pointer and touch use the same thumb.
- Preview dots use the same track as the thumb, with 101 at the endpoint and null at 50. They remain visible in bulk edit while **No change** or **Default** is selected.
- Ordinary sliders snap to `PERCENT_LEVEL_STEP` (5) by default. Snapping the thumb for display leaves the stored value intact until the operator changes the control. Leaving radio default starts at 50.

## Related

- [`ChannelBulkEditModal`](../library/ChannelBulkEditModal.md)
- [`ModePanels`](../channels/modePanels/ModePanels.md)
- [Library editing](../../../../docs/features/library/README.md#channel-power)
- Dev demos: `/styleguide/forms`
