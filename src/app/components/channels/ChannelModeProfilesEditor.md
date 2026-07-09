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

<ChannelModeProfilesEditor
  profiles={modeProfiles}
  library={library}
  rxFrequency={rxHz}
  txFrequency={txHz}
  onChange={setModeProfiles}
/>;
```

## Behaviour

- Renders `PillTabs` with one tab per profile (`ModePill` + label); empty state when `profiles` is empty.
- Analog tabs: bandwidth, RX/TX tone, squelch slider; SSB tab adds USB/LSB sideband control.
- DMR tab: colour code, timeslot, DMR ID, digital contact or talk group, RX group list, then **`RxGroupListSummary`** when a list is selected (live preview; link to list editor).
- D-STAR / YSF / NXDN / TETRA: mode-specific fields per internal model.
- P25 / M17 stubs show placeholder copy until typed profiles ship.
- Shared RF fields (name, frequencies, location) live on the parent channel editor, not here.

## Related

- [PillTabs](../ui/PillTabs.md)
- [RxGroupListSummary](../library/RxGroupListSummary.md)
- [ChannelModesMultiSelect](./ChannelModesMultiSelect.md)
- [docs/features/data-model/README.md](../../../docs/features/data-model/README.md)
- [#16](https://github.com/pskillen/codeplug-studio/issues/16)
