# BulkEditField

## Purpose

Opt-in wrapper for bulk-edit sliders, selects, and other non-segment controls. **No change** leaves existing values; **Set** enables the wrapped control so Apply writes it. Uses [`GradientSegmentedControl`](../ui/GradientSegmentedControl.md) — the same chrome as other bulk-edit fields.

## Props

| Prop              | Type                         | Description                                                                                        |
| ----------------- | ---------------------------- | -------------------------------------------------------------------------------------------------- |
| `optedIn`         | `boolean`                    | When false, the field is idle and children are disabled                                            |
| `onOptedInChange` | `(optedIn: boolean) => void` | Fired when the operator picks **No change** or **Set**                                             |
| `hasSharedValue`  | `boolean` (optional)         | When true and idle, the primary indicator sits on **Set** (invert); outline stays on **No change** |
| `label`           | `ReactNode` (optional)       | Title above the gradient                                                                           |
| `description`     | `ReactNode` (optional)       | Copy below the gradient                                                                            |
| `children`        | `ReactNode`                  | The control to enable when opted in                                                                |
| `disabled`        | `boolean` (optional)         | Disable opt-in and children                                                                        |

## Usage

```tsx
<BulkEditField
  label="RX tone"
  optedIn={form.changeRxTone}
  onOptedInChange={(changeRxTone) => setForm((prev) => ({ ...prev, changeRxTone }))}
  hasSharedValue={shared.rxTone !== undefined}
>
  <Select data={toneSelectOptions()} value={form.rxTone} onChange={...} />
</BulkEditField>
```

Gradient fields with a real domain (Allow TX / RX only, Off / On) use `idleOption` / `sharedValue` on [`GradientSegmentedControl`](../ui/GradientSegmentedControl.md) instead of this wrapper.

## Behaviour

- Starts as **No change** from the parent’s `optedIn={false}`.
- Children stay mounted while idle (preview dots on sliders) but the fieldset is disabled.
- There is no **Shared value: …** line — shared state is the inverted primary on **Set**.

## Related

- [`ChannelBulkEditModal`](./ChannelBulkEditModal.md)
- [`GradientSegmentedControl`](../ui/GradientSegmentedControl.md)
- [library hub](../../../docs/features/library/README.md)
