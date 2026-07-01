# ChannelModesMultiSelect

## Purpose

Lets operators choose which RF modes a library channel supports. Selection drives `Channel.modeProfiles[]` via `syncModeProfiles` in the channel editor — one profile per selected mode.

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `value` | `ChannelMode[]` | Currently selected modes |
| `onChange` | `(modes: ChannelMode[]) => void` | Called when selection changes |
| `label` | `string` | Field label (default: `Modes`) |
| `description` | `string` | Helper text under the label |

## Usage

```tsx
import ChannelModesMultiSelect from '@app/components/channels/ChannelModesMultiSelect.tsx';
import { syncModeProfiles } from '@core/domain/modeProfiles.ts';

const selectedModes = modeProfiles.map((p) => p.mode);

<ChannelModesMultiSelect
  value={selectedModes}
  onChange={(modes) => setModeProfiles(syncModeProfiles(modes, modeProfiles))}
/>
```

## Behaviour

- Options come from `CHANNEL_MODES` in `src/app/lib/channelModes.ts` (excludes display-only `other`).
- No “primary mode” — all selected modes are equal; profile tab order follows selection order.
- Deselecting a mode drops its profile on the next sync (parent should call `syncModeProfiles`).

## Related

- [ChannelModeProfilesEditor](./ChannelModeProfilesEditor.md)
- [docs/reference/channel-modes.md](../../../docs/reference/channel-modes.md)
- [#16](https://github.com/pskillen/codeplug-studio/issues/16)
