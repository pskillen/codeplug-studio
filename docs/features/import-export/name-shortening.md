## Purpose

Export-time channel wire name composition and shortening. Runs at the CPS boundary — library CRUD does not enforce name length caps.

**Tracking:** [#90](https://github.com/pskillen/codeplug-studio/issues/90)

**Code:** `src/core/domain/channelNaming.ts`, `src/core/import-export/channelExpansion/shortenName.ts`, `exportWireNames.ts`, `multiMode.ts`

## Pipeline

1. **Compose** — `composeChannelWireName` from callsign, name, export name mode (browser fallback setting), optional `abbreviation` on library entities.
2. **Build override** — `channelOverrides.wireName` on the format build (if set).
3. **Multi-mode expansion** — per-mode suffix rows (`-F`, `-D`, `-Y`, `-DS`, …) when `expandModes` is true and multiple `modeProfiles` exist ([#89](https://github.com/pskillen/codeplug-studio/issues/89)).
4. **Shorten** — `applyWireNameLimits` / `finalizeWireName` using the abbreviation dictionary (`data/dictionaries/abbreviations.yaml`) when `shortenNames` is true and the name exceeds `maxNameLength` (profile default or operator override).

## Operator settings

`ExportNameSettingsFields` on `/builds/:id/export` persists preferences in browser `localStorage` via `useExportSettings`:

| Key                                               | Effect                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------- |
| `codeplug-studio.export.shortenNames`             | Enable abbreviation shortening (default on)                                     |
| `codeplug-studio.export.maxNameLength`            | Override profile `nameLimit`                                                    |
| `codeplug-studio.export.nameModeOverride`         | Default name style when no build wire override is set                           |
| `codeplug-studio.export.useChannelAbbreviation`   | Prefer `Channel.abbreviation`                                                   |
| `codeplug-studio.export.useTalkGroupAbbreviation` | Prefer `TalkGroup.abbreviation` (DM32-style; hidden on lean OpenGD77 export UI) |

Wire preview pages read the same settings when computing `generatedWireName`.

## Related

- [wire-preview.md](../builds/wire-preview.md) — UI workflow
- [OpenGD77 profiles](opengd77/README.md) — per-radio `nameLimit`
- [multi-talkgroup-expansion.md](../../reference/multi-talkgroup-expansion.md) — RX-list fan-out (future formats)
