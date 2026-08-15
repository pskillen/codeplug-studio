# ForbidTransmitSegment

## Purpose

Channel transmit permission: **Allow TX** or **RX only**. Thin wrapper around [`GradientSegmentedControl`](../ui/GradientSegmentedControl.md) using the `allowForbid` colour scheme.

## Props

| Prop             | Type                                           | Description                                                                 |
| ---------------- | ---------------------------------------------- | --------------------------------------------------------------------------- |
| `value`          | `ForbidTransmitOverride` (`default` \| `allow` \| `forbid`) | Channel-level override; `default` defers to library + build cascade |
| `onChange`       | `(value: ForbidTransmitOverride) => void`      | Called when the operator changes the control                                |
| `includeDefault` | `boolean`                                      | When true (channel editor), includes **Default**. Default `true`            |
| `disabled`       | `boolean`                                      | Optional                                                                    |

## Usage

```tsx
import ForbidTransmitSegment from '@app/components/channels/ForbidTransmitSegment.tsx';

<ForbidTransmitSegment value={forbidTransmit} onChange={setForbidTransmit} />;
```

## Behaviour

- **Allow TX** → channel may transmit on export.
- **RX only** → receive-only; the radio will not transmit on this channel.
- **Default** (when `includeDefault`) → library behavioural defaults and build export overrides.
- Indicator colour follows the shared `allowForbid` preset (teal when Allow TX, orange when RX only).

On the channel editor this control lives in the **Frequency** panel ([#1209](https://github.com/pskillen/codeplug-studio/issues/1209)). Vendor-neutral field name (`forbidTransmit`); wire mapping is format-specific.

## Related

- [GradientSegmentedControl](../ui/GradientSegmentedControl.md)
- [TxPermitSegment](./TxPermitSegment.md) — whether you may transmit while the frequency is in use
- [Library feature hub](../../../../docs/features/library/README.md)
