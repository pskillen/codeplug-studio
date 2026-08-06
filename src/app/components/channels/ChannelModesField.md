# ChannelModesField

Identity-panel mode multi-select for the channel editor (mk2 E1).

## Purpose

Replaces the separate Modes panel mode switcher. Analog and Digital chip groups toggle `modeProfiles` via the parent’s `syncModeProfiles` wiring.

## Props

| Prop            | Type                                 | Notes          |
| --------------- | ------------------------------------ | -------------- |
| `selectedModes` | `readonly CoreChannelMode[]`         | Active modes   |
| `onChange`      | `(modes: CoreChannelMode[]) => void` | Toggle handler |

## Usage

```tsx
<ChannelModesField selectedModes={modeProfiles.map((p) => p.mode)} onChange={handleModesChange} />
```

## Related

- [docs/features/library/README.md](../../../../docs/features/library/README.md)
- [ChannelModeProfilesEditor.tsx](./ChannelModeProfilesEditor.tsx) — stacked settings per mode
