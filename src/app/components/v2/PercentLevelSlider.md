# PercentLevelSlider

## Purpose

Power and analog squelch as a 0–100% slider with an optional **Radio default** checkbox (`value == null`). Used on the channel editor, analog mode panel, bulk-edit modal, and `/styleguide/forms`.

## Props

| Prop                   | Type                              | Description                                                                                                |
| ---------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `label`                | `string`                          | Field title                                                                                                |
| `value`                | `number \| null`                  | Percent, or `null` for radio default                                                                       |
| `onChange`             | `(value: number \| null) => void` | Slider or default-checkbox handler                                                                         |
| `zeroLabel`            | `string` (optional)               | Label for `0` (e.g. Open (0%) on squelch)                                                                  |
| `defaultLabel`         | `string` (optional)               | Checkbox label. Default **Radio default**                                                                  |
| `description`          | `string` (optional)               | Help under the title                                                                                       |
| `min` / `max` / `step` | `number` (optional)               | Range. Default 0–100, step 5                                                                               |
| `showValue`            | `boolean` (optional)              | When false, omit `— {value}` and hide the primary thumb and bar. Default: hide only when `value` is `null` |
| `showDefaultCheckbox`  | `boolean` (optional)              | Default true. Set false when a parent gradient owns **Default**                                            |
| `previewValues`        | `(number \| null)[]` (optional)   | Bulk-selection percents drawn as outline dots on the track. Null (radio default) is marked at 50%          |

## Usage

```tsx
<PercentLevelSlider label="Power" value={power} onChange={setPower} />

<PercentLevelSlider
  label="Power"
  value={form.power}
  onChange={(power) => setForm((prev) => ({ ...prev, power }))}
  showValue={form.changePower && form.power != null}
  showDefaultCheckbox={false}
  previewValues={channels.map((channel) => channel.power)}
/>
```

## Behaviour

- **Radio default** (`value == null`) or `showValue={false}`: no `— 50%` (or **Radio default**) suffix, and the primary thumb and filled bar are hidden (the slider parks at `min` so it does not sit at 50%). The track and marks stay visible.
- `previewValues` are visual only; they do not change `value`. Null (radio default) is drawn at 50% so you can still see where those channels sit; the primary thumb stays hidden while idle or on Default.
- Snaps to `PERCENT_LEVEL_STEP` (5).

## Related

- [`ChannelBulkEditModal`](../library/ChannelBulkEditModal.md)
- [`ChannelModeProfilesEditor`](../channels/ChannelModeProfilesEditor.md)
- Dev demos: `/styleguide/forms`
