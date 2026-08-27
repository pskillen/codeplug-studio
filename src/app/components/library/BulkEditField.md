# BulkEditField

## Purpose

Opt-in wrapper for bulk-edit sliders, selects, and other non-segment controls. **No change** leaves existing values; **Set** enables the wrapped control so Apply writes it.

## Props

| Prop              | Type                         | Description                                                            |
| ----------------- | ---------------------------- | ---------------------------------------------------------------------- |
| `optedIn`         | `boolean`                    | When false, the field is idle and children are disabled                |
| `onOptedInChange` | `(optedIn: boolean) => void` | Fired when the operator picks **No change** or **Set**                 |
| `sharedHint`      | `ReactNode` (optional)       | Preview of the value every selected row shares — shown only while idle |
| `children`        | `ReactNode`                  | The control to enable when opted in                                    |
| `disabled`        | `boolean` (optional)         | Disable opt-in and children                                            |

## Usage

```tsx
<BulkEditField
  optedIn={form.changePower}
  onOptedInChange={(changePower) => setForm((prev) => ({ ...prev, changePower }))}
  sharedHint={sharedPower == null ? undefined : `${sharedPower}%`}
>
  <PercentLevelSlider
    label="Power"
    value={form.power}
    onChange={(power) => setForm((prev) => ({ ...prev, power }))}
  />
</BulkEditField>
```

Gradient segmented fields use [`GradientSegmentedControl`](../ui/GradientSegmentedControl.md) `idleOption` / `sharedValue` instead of this wrapper.

## Behaviour

- Starts as **No change** from the parent’s `optedIn={false}`.
- Children stay mounted while idle so a shared value can be shown, but the fieldset is disabled so they cannot be edited.
- `sharedHint` is copy-only — it does not opt the field in.

## Related

- [`ChannelBulkEditModal`](./ChannelBulkEditModal.md)
- [`GradientSegmentedControl`](../ui/GradientSegmentedControl.md)
- [library hub](../../../docs/features/library/README.md)
