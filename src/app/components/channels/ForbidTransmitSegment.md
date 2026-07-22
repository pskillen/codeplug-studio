# ForbidTransmitSegment

## Purpose

Channel transmit permission control: **Allow TX** (default) or **RX only** (`forbidTransmit: true`). Thin wrapper around [`GradientSegmentedControl`](../ui/GradientSegmentedControl.md) using the `allowForbid` colour scheme.

## Props

| Prop       | Type                           | Description                                   |
| ---------- | ------------------------------ | --------------------------------------------- |
| `value`    | `boolean \| null \| undefined` | `null` / omitted → Allow TX; `true` → RX only |
| `onChange` | `(value: boolean) => void`     | Called when the operator changes mode         |

## Usage

```tsx
import ForbidTransmitSegment from '@app/components/channels/ForbidTransmitSegment.tsx';

<ForbidTransmitSegment value={forbidTransmit} onChange={setForbidTransmit} />;
```

## Behaviour

- **Allow TX** → `forbidTransmit: false` (or `null` / omitted on legacy rows) — normal transmit on export.
- **RX only** → `forbidTransmit: true` — maps to CPS `Rx Only` / `Yes` at the OpenGD77 export boundary.
- Indicator colour follows the shared `allowForbid` preset (teal when Allow TX, orange when RX only).

Vendor-neutral field name; wire column mapping is format-specific (see [OpenGD77 channels reference](../../../../docs/reference/formats/opengd77/channels.md)).

## Related

- [GradientSegmentedControl](../ui/GradientSegmentedControl.md)
- [Data model — Channel](../../../../docs/features/data-model/README.md)
- [Library feature hub](../../../../docs/features/library/README.md)
