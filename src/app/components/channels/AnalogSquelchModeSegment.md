# AnalogSquelchModeSegment

## Purpose

Analog **squelch mode** control — **Default**, **Carrier**, **Tone**. Thin wrapper around [`GradientSegmentedControl`](../ui/GradientSegmentedControl.md) using the `three` colour scheme.

## Props

| Prop             | Type                                                           | Description                                                         |
| ---------------- | -------------------------------------------------------------- | ------------------------------------------------------------------- |
| `value`          | `AnalogSquelchModeOverride` (`default` \| `carrier` \| `tone`) | Channel-level override; `default` defers to library + build cascade |
| `onChange`       | `(value: AnalogSquelchModeOverride) => void`                   | Called when the operator changes the control                        |
| `includeDefault` | `boolean`                                                      | When true (channel editor), includes **Default**. Default `true`    |
| `disabled`       | `boolean`                                                      | Optional                                                            |
| `layout`         | `'stack' \| 'row'`                                             | Forwarded to `GradientSegmentedControl`. Default `'stack'`          |

## Usage

```tsx
import AnalogSquelchModeSegment from '@app/components/channels/AnalogSquelchModeSegment.tsx';

<AnalogSquelchModeSegment value={analogSquelchMode} onChange={setAnalogSquelchMode} layout="row" />;
```

## Behaviour

- **Carrier** — squelch opens on carrier detect only.
- **Tone** — squelch requires a matching CTCSS/DCS tone (uses the channel's configured RX tone).
- **Default** (when `includeDefault`) — library behavioural defaults and build export overrides; without it, "Override library and per-channel settings for this build" (build-level usage).
- Indicator colour follows the shared `three` preset; the neutral `default` option renders with no colour override.

On the channel editor this control lives in the analog **Mode settings** panel via [`ChannelModeProfilesEditor`](./ChannelModeProfilesEditor.md), at `layout="row"`.

## Related

- [GradientSegmentedControl](../ui/GradientSegmentedControl.md)
- [ChannelModeProfilesEditor](./ChannelModeProfilesEditor.md)
- [Library feature hub](../../../../docs/features/library/README.md)
