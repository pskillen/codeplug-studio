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

## Behaviour

- **Modes** heading matches panel-title prominence (14px / 600).
- Selected chips use the same fill as [`ModePill`](../pills/ModePill.tsx) (`modeColor` + dark text). Unselected chips keep a mode-coloured border.

On the channel editor ([#1209](https://github.com/pskillen/codeplug-studio/issues/1209)): callsign first (full row), name + abbreviation on one row, comment below; wire-name examples in a second column on desktop and a collapsed **Name examples** disclosure on mobile.

## Related

- [docs/features/library/README.md](../../../../docs/features/library/README.md)
- [ChannelModeProfilesEditor.tsx](./ChannelModeProfilesEditor.tsx) — stacked settings per mode
