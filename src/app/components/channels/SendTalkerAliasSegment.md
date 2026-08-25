# SendTalkerAliasSegment

## Purpose

DMR **send talker alias** toggle — **Default**, **On**, **Off**. Thin wrapper around [`GradientSegmentedControl`](../ui/GradientSegmentedControl.md) using the `onOff` colour scheme.

## Props

| Prop             | Type                                                   | Description                                                         |
| ---------------- | ------------------------------------------------------ | ------------------------------------------------------------------- |
| `value`          | `SendTalkerAliasOverride` (`default` \| `on` \| `off`) | Channel-level override; `default` defers to library + build cascade |
| `onChange`       | `(value: SendTalkerAliasOverride) => void`             | Called when the operator changes the control                        |
| `includeDefault` | `boolean`                                              | When true (channel editor), includes **Default**. Default `true`    |
| `disabled`       | `boolean`                                              | Optional                                                            |
| `layout`         | `'stack' \| 'row'`                                     | Forwarded to `GradientSegmentedControl`. Default `'stack'`          |

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

On the channel editor this control lives in the DMR **Mode settings** panel via [`ChannelModeProfilesEditor`](./ChannelModeProfilesEditor.md), at `layout="row"`.

## Related

- [GradientSegmentedControl](../ui/GradientSegmentedControl.md)
- [ChannelModeProfilesEditor](./ChannelModeProfilesEditor.md)
- [Library feature hub](../../../../docs/features/library/README.md)
