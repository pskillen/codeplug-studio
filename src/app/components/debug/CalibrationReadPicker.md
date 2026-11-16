# CalibrationReadPicker

The **Read** and **Overlay (optional)** selects at the top of Calibration.

## Purpose

Picks which read the Calibration tab shows and which second read it overlays. Grown from the Mini's two `Select`s. Knows no radio.

## Props

| Prop        | Type                           | Notes                                |
| ----------- | ------------------------------ | ------------------------------------ |
| `entries`   | `{ id, label, time? }[]`       | The reads; `time` prints in brackets |
| `readId`    | `string \| null`               | The selected read                    |
| `overlayId` | `string \| null`               | The overlay read; `null` is None     |
| `onRead`    | `(id: string) => void`         |                                      |
| `onOverlay` | `(id: string \| null) => void` | `null` when None is picked           |

Exports: `NO_OVERLAY_LABEL`.

## Usage

```tsx
<CalibrationReadPicker
  entries={reads}
  readId={readId}
  overlayId={overlayId}
  onRead={setReadId}
  onOverlay={setOverlayId}
/>
```

## Behaviour

- Two columns from `sm` (48em), stacked on a phone.
- The Overlay list excludes the selected read and starts with **None**; an overlay equal to the read shows as None.
- Read cannot be cleared.

## Related

- [CalibrationChartCard.md](./CalibrationChartCard.md)
- [Radio debug hub](../../../../docs/features/radio-debug/README.md)
