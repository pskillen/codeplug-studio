# ChannelModeProfilesEditor

## Purpose

Stacked per-mode settings blocks for a multi-mode library channel. One block per entry in `Channel.modeProfiles[]`; fields shown depend on the mode (analog, DMR, D-STAR, YSF, NXDN, TETRA, or stub).

## Props

| Prop          | Type                                       | Description                                                    |
| ------------- | ------------------------------------------ | -------------------------------------------------------------- |
| `profiles`    | `ChannelModeProfile[]`                     | Current mode profiles (order = display order)                  |
| `library`     | `Library`                                  | Project library for DMR contact / RX-list / talk-group selects |
| `channel`     | `Channel \| null`                          | Saved channel for DMR BrandMeister RX-list sync (optional)     |
| `rxFrequency` | `number \| null`                           | Live RX frequency (Hz) for DMR operating mode hints            |
| `txFrequency` | `number \| null`                           | Live TX frequency (Hz) for DMR operating mode hints            |
| `onChange`    | `(profiles: ChannelModeProfile[]) => void` | Called when any profile field changes                          |

## Usage

```tsx
import ChannelModeProfilesEditor from '@app/components/channels/ChannelModeProfilesEditor.tsx';

<ChannelModeProfilesEditor
  profiles={modeProfiles}
  library={library}
  channel={savedChannel}
  rxFrequency={rxHz}
  txFrequency={txHz}
  onChange={setModeProfiles}
/>;
```

## Behaviour

- Renders stacked blocks with a mode header (`ModePill` + label); empty state when `profiles` is empty.
- Analog blocks: bandwidth, RX/TX tone, squelch slider; SSB adds USB/LSB sideband control.
- DMR block: colour code, timeslot, DMR ID, digital contact or talk group, RX group list, **`RxGroupListSummary`** when a list is selected, then **`BrandmeisterRxListSyncAction`** when `channel` is set.
- D-STAR / YSF / NXDN / TETRA: mode-specific fields per internal model.
- P25 / M17 stubs show placeholder copy until typed profiles ship.
- Shared RF fields (name, frequencies, location, directory verify) live on the parent channel editor, not here.

## Related

- [`BrandmeisterRxListSyncAction.md`](../repeaters/BrandmeisterRxListSyncAction.md)
- [PillTabs](../ui/PillTabs.md)
- [docs/features/library/README.md](../../../docs/features/library/README.md)
