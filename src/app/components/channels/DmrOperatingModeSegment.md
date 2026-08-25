# DmrOperatingModeSegment

## Purpose

DMR **operating mode** control — **Auto**, **DMO** (dmo-simplex), **Repeater**. Thin wrapper around [`GradientSegmentedControl`](../ui/GradientSegmentedControl.md) using the `three` colour scheme, with `auto` as the neutral value.

## Props

| Prop          | Type                                          | Description                                                                |
| ------------- | --------------------------------------------- | -------------------------------------------------------------------------- |
| `value`       | `DmrOperatingMode \| null`                    | `null` renders as **Auto**                                                 |
| `onChange`    | `(dmrMode: DmrOperatingMode \| null) => void` | Called when the operator changes the control; `'auto'` maps back to `null` |
| `rxFrequency` | `number \| null`                              | Used to infer the Auto-mode label (repeater vs DMO/simplex)                |
| `txFrequency` | `number \| null`                              | Used to infer the Auto-mode label                                          |
| `disabled`    | `boolean`                                     | Optional                                                                   |
| `layout`      | `'stack' \| 'row'`                            | Forwarded to `GradientSegmentedControl`. Default `'stack'`                 |

## Usage

```tsx
import DmrOperatingModeSegment from '@app/components/channels/DmrOperatingModeSegment.tsx';

<DmrOperatingModeSegment
  value={profile.dmrMode ?? null}
  onChange={(dmrMode) => onPatch({ dmrMode })}
  rxFrequency={rxFrequency}
  txFrequency={txFrequency}
  layout="row"
/>;
```

## Behaviour

- **Auto** — mode is inferred from RX/TX frequencies (`inferDmrOperatingMode`) at export; the description line shows what Auto currently resolves to.
- **DMO** / **Repeater** — explicit override, ignores frequency inference at export.
- Spells its neutral option `'auto'` rather than `'default'`, so it passes `neutralValues={['auto']}` to `GradientSegmentedControl` — otherwise Auto would absorb a real palette slot from the `three` scheme instead of rendering with no colour override.

On the channel editor this control lives in the DMR **Mode settings** panel via [`ChannelModeProfilesEditor`](./ChannelModeProfilesEditor.md), at `layout="row"`.

## Related

- [GradientSegmentedControl](../ui/GradientSegmentedControl.md)
- [ChannelModeProfilesEditor](./ChannelModeProfilesEditor.md)
- [Library feature hub](../../../../docs/features/library/README.md)
