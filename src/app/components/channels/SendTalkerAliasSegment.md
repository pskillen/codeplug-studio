# SendTalkerAliasSegment

## Purpose

DMR **send talker alias** toggle — **Default**, **On**, **Off**. Thin wrapper around [`GradientSegmentedControl`](../ui/GradientSegmentedControl.md) using the `onOff` colour scheme.

## Props

| Prop             | Type                                                   | Description                                                                 |
| ---------------- | ------------------------------------------------------ | --------------------------------------------------------------------------- |
| `value`          | `SendTalkerAliasOverride` (`default` \| `on` \| `off`) | Channel-level override; **Default** uses the talker-alias setting on export |
| `onChange`       | `(value: SendTalkerAliasOverride) => void`             | Called when the operator changes the control                                |
| `includeDefault` | `boolean`                                              | When true (channel editor), includes **Default**. Default `true`            |
| `disabled`       | `boolean`                                              | Optional                                                                    |
| `layout`         | `'stack' \| 'row' \| 'column'`                         | Forwarded to `GradientSegmentedControl`. Default `'stack'`                  |

## Usage

```tsx
import SendTalkerAliasSegment from '@app/components/channels/SendTalkerAliasSegment.tsx';

<SendTalkerAliasSegment value={sendTalkerAlias} onChange={setSendTalkerAlias} layout="row" />;
```

## Behaviour

- **On** — the radio sends its talker alias (callsign/name) on transmit, when the DMR profile supports it.
- **Off** — talker alias is not sent.
- **Default** (when `includeDefault`) — library behavioural defaults and build export overrides.
- Indicator colour follows the shared `onOff` preset (teal when On, gray when Off); the neutral `default` option renders with no colour override.

On the channel editor this control lives in the mode's settings via [`modePanels/ModePanels`](./modePanels/ModePanels.md): under **Mode and frequency** for a single-mode channel, or in the DMR panel under **Modes** when two or more modes are set, at `layout="row"`.

## Related

- [GradientSegmentedControl](../ui/GradientSegmentedControl.md)
- [modePanels/ModePanels](./modePanels/ModePanels.md)
- [Library feature hub](../../../../docs/features/library/README.md)
