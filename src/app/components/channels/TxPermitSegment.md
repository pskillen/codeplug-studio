# TxPermitSegment

Tri-state **TX permit** control for channel editors and bulk edit — **Default**, **Permit always**, **Busy lock**. Set `includeDefault={false}` for library defaults or build export overrides.

## Purpose

Whether you may transmit while the frequency is already in use. Distinct from receive-only ([ForbidTransmitSegment](./ForbidTransmitSegment.md)).

## Props

| Prop             | Type                                | Description                                                |
| ---------------- | ----------------------------------- | ---------------------------------------------------------- |
| `value`          | `TxPermitOverride`                  | `default` \| `permitAlways` \| `busyLock`                  |
| `onChange`       | `(value: TxPermitOverride) => void` | Called when the operator changes the control               |
| `includeDefault` | `boolean`                           | When false, omits **Default**. Default `true`              |
| `disabled`       | `boolean`                           | Optional                                                   |
| `layout`         | `'stack' \| 'row' \| 'column'`      | Forwarded to `GradientSegmentedControl`. Default `'stack'` |

## Behaviour

- **Busy lock** — do not transmit while the frequency is in use.
- **Permit always** — you can hold TX anyway.
- **Default** — library behavioural defaults and build export overrides.

On the channel editor this control lives in the **RF** panel ([#1209](https://github.com/pskillen/codeplug-studio/issues/1209)), at `layout="row"` so the control no longer forces the panel to full-width single-column.

## Related

- [channel-behavioural-defaults reference](../../../../docs/reference/channel-behavioural-defaults.md)
- [ForbidTransmitSegment](./ForbidTransmitSegment.md)
