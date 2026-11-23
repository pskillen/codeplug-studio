# ChannelModeProfilesEditor

## Purpose

Thin stacked wrapper over **`ModePanel`** for a multi-mode library channel. One block per entry in `Channel.modeProfiles[]` with a mode header (`ModePill` + label); field layout and grouping live in [`modePanels/ModePanels.md`](./modePanels/ModePanels.md).

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

- Empty state when `profiles` is empty (new channels start with no modes; bandwidth/tones/squelch only appear once FM, AM or SSB is selected).
- Each non-empty block renders **`ModePanel`** with `context.savedChannel` from `channel`, live frequencies, and `compact` from the mobile breakpoint.
- Per-mode fields, Access / Call / Listen / You grouping, and analogue tone order: see **[ModePanels.md](./modePanels/ModePanels.md)**.
- Shared RF fields (name, frequencies, location, directory verify) live on the parent channel editor, not here.

## Related

- [ModePanels](./modePanels/ModePanels.md)
- [ChannelToneField](./ChannelToneField.md)
- [`BrandmeisterRxListSyncAction.md`](../repeaters/BrandmeisterRxListSyncAction.md)
- [PillTabs](../ui/PillTabs.md)
- [docs/features/library/README.md](../../../docs/features/library/README.md)
