# ChannelModePicker

## Purpose

Pick, switch, add, and remove a channel's modes in the new channel editor. Replaces the multi-select chip wall once wired into `ChannelEditor`. Three states: no mode (placeholder with presets), one mode (single-select switch), two or more (removable chips).

## ChannelModePicker props

| Prop       | Type                     | Description                                          |
| ---------- | ------------------------ | ---------------------------------------------------- |
| `modes`    | `readonly ChannelMode[]` | Current modes in profile order (core `ChannelMode`). |
| `onSwitch` | `(mode) => void`         | Replace mode when zero or one mode is selected.      |
| `onAdd`    | `(mode) => void`         | Append a mode when two or more are active.           |
| `onRemove` | `(mode) => void`         | Remove a mode (settings park until save).            |
| `onPreset` | `(preset) => void`       | Apply a one-tap preset when no mode yet.             |
| `compact`  | `boolean`                | Tighter chip gaps (optional).                        |

## AddModeMenu props

| Prop      | Type                     | Description                                                 |
| --------- | ------------------------ | ----------------------------------------------------------- |
| `modes`   | `readonly ChannelMode[]` | Modes already on the channel (excluded from the menu).      |
| `onAdd`   | `(mode) => void`         | Called when the user picks a mode.                          |
| `variant` | `'link' \| 'chip'`       | Link under single-mode settings, or chip in multi-mode row. |

## Usage

Wire callbacks to pure transitions in `@core/domain/modeProfiles.ts`:

```tsx
import {
  addChannelMode,
  removeChannelMode,
  switchChannelMode,
  type ChannelModeEdit,
} from '@core/domain/modeProfiles.ts';
import ChannelModePicker, { AddModeMenu } from './ChannelModePicker.tsx';
import type { ModePreset } from '../../lib/channelModes.ts';

function onSwitch(edit: ChannelModeEdit, mode: ChannelMode) {
  return switchChannelMode(edit, mode);
}

function onPreset(edit: ChannelModeEdit, preset: ModePreset) {
  const [first, ...rest] = preset.modes;
  let next = switchChannelMode(edit, first);
  for (const mode of rest) {
    next = addChannelMode(next, mode);
  }
  return next;
}
```

## Behaviour

- **No mode:** dashed box, presets FM, DMR, FM + DMR; first preset mode becomes main. Other modes: AM, NXDN, P25, M17, More (SSB, D-STAR, YSF, Tetra).
- **One mode:** FM AM DMR NXDN P25 M17 switch; rare modes under More. Editor renders `AddModeMenu variant="link"` below settings (not inside the picker).
- **Two or more:** coloured chips with remove (×), then `AddModeMenu variant="chip"`.
- Switching or removing parks the profile; switching or adding back restores it (`parked` is editor-only).

## Related

- `MODE_PRESETS`, `MODE_PICKER_COMMON`, `MODE_PICKER_MORE` in `src/app/lib/channelModes.ts`
- `switchChannelMode`, `addChannelMode`, `removeChannelMode` in `src/core/domain/modeProfiles.ts`
- [channel-modes-ui.md](../../../../docs/reference/styleguide/channel-modes-ui.md)
- Live demo: `/styleguide/channel-modes`
