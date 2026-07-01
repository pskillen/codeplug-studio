# ChannelModeProfilesEditor

## Purpose

Tabbed editor for per-mode settings on a multi-mode library channel. One tab per entry in `Channel.modeProfiles[]`; fields shown depend on the mode (analog, DMR, D-STAR, YSF, NXDN, TETRA, or stub).

## Props

| Prop       | Type                                       | Description                                                    |
| ---------- | ------------------------------------------ | -------------------------------------------------------------- |
| `profiles` | `ChannelModeProfile[]`                     | Current mode profiles (order = tab order)                      |
| `library`  | `Library`                                  | Project library for DMR contact / RX-list / talk-group selects |
| `onChange` | `(profiles: ChannelModeProfile[]) => void` | Called when any profile field changes                          |

## Usage

```tsx
import ChannelModeProfilesEditor from '@app/components/channels/ChannelModeProfilesEditor.tsx';

<ChannelModeProfilesEditor profiles={modeProfiles} library={library} onChange={setModeProfiles} />;
```

## Behaviour

- Renders nothing useful when `profiles` is empty — parent should pair with `ChannelModesMultiSelect`.
- Analog tabs: bandwidth, RX/TX tone, squelch slider.
- DMR tab: colour code, timeslot, DMR ID, digital contact or talk group, RX group list.
- D-STAR / YSF / NXDN / TETRA: mode-specific fields per internal model.
- P25 / M17 stubs show placeholder copy until typed profiles ship.
- Shared RF fields (name, frequencies, location) live on the parent channel editor, not here.

## Related

- [ChannelModesMultiSelect](./ChannelModesMultiSelect.md)
- [docs/features/data-model/README.md](../../../docs/features/data-model/README.md)
- [#16](https://github.com/pskillen/codeplug-studio/issues/16)
