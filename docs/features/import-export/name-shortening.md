## Purpose

Export-time channel wire name composition and shortening. Runs at the CPS boundary — library CRUD does not enforce name length caps.

**Tracking:** [#90](https://github.com/pskillen/codeplug-studio/issues/90), talk group abbrev [#110](https://github.com/pskillen/codeplug-studio/issues/110)

**Code:** `src/core/domain/channelNaming.ts`, `src/core/import-export/channelExpansion/shortenName.ts`, `exportWireNames.ts`, `multiMode.ts`, `multiTalkGroup.ts`, `multiTalkGroupWireName.ts`

## Pipeline

1. **Compose** — `composeChannelWireName` from callsign, name, and export name mode (browser fallback setting).
2. **Build override** — `channelOverrides.wireName` on the format build (if set).
3. **Multi-mode expansion** — per-mode suffix rows (`-F`, `-D`, `-Y`, `-DS`, …) when `expandModes` is true and multiple `modeProfiles` exist ([#89](https://github.com/pskillen/codeplug-studio/issues/89)).
4. **Multi-talkgroup expansion** (DM32-style formats) — `composeMultiTalkGroupWireName` + `applyMultiTalkGroupWireNameLimits` when RX group lists fan out to one row per member ([#110](https://github.com/pskillen/codeplug-studio/issues/110)); see [multi-talkgroup-expansion.md](../../reference/multi-talkgroup-expansion.md).
5. **Shorten** — `applyWireNameLimits` / `finalizeWireName` when `shortenNames` is true and the name exceeds `maxNameLength`.
   - **Channel abbrev:** if `useChannelAbbreviation` is enabled and `Channel.abbreviation` is set, that label is tried **before** dictionary / vowel strategies; multi-mode suffixes (`-F`, `-D`, …) are preserved.
   - **Talk group abbrev:** applied at **shorten-time**, not base channel compose — via `talkGroupMemberSuffix` (legacy `append` mode) and `fixedSuffix` (TG-first compose modes) in `shortenWireName`. `TalkGroup.abbreviation` on the library entity is the source label; `useTalkGroupAbbreviation` gates append-mode suffix replacement. Regenerate `dictionary.generated.ts` via `npm run generate:abbreviations` (runs automatically before `test` and `build`).

## Operator settings

`ExportNameSettingsFields` on `/builds/:id/export` persists preferences in browser `localStorage` via `useExportSettings`:

| Key                                               | Effect                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------- |
| `codeplug-studio.export.shortenNames`             | Enable abbreviation shortening (default on)                                     |
| `codeplug-studio.export.maxNameLength`            | Override profile `nameLimit`                                                    |
| `codeplug-studio.export.nameModeOverride`         | Default name style when no build wire override is set                           |
| `codeplug-studio.export.useChannelAbbreviation`   | Prefer `Channel.abbreviation` before dictionary shortening (default on)         |
| `codeplug-studio.export.useTalkGroupAbbreviation` | Prefer `TalkGroup.abbreviation` for multi-talkgroup suffix shortening (DM32-style; hidden on lean OpenGD77 export UI until DM32 export ships) |

Wire preview pages read the same settings when computing `generatedWireName`.

## Related

- [wire-preview.md](../builds/wire-preview.md) — UI workflow
- [dm32-progress.md](dm32-progress.md) — DM32 export epic execution log ([#37](https://github.com/pskillen/codeplug-studio/issues/37))
- [OpenGD77 profiles](opengd77/README.md) — per-radio `nameLimit`
- [multi-talkgroup-expansion.md](../../reference/multi-talkgroup-expansion.md) — RX-list fan-out rules
- [DM32 talkgroups wire reference](../../reference/dm32/talkgroups.md) — CPS column detail (tier 3)
