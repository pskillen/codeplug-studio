## Purpose

Export-time channel wire name composition and shortening. Runs at the CPS boundary — library CRUD does not enforce name length caps.

**Tracking:** [#90](https://github.com/pskillen/codeplug-studio/issues/90), talk group abbrev [#110](https://github.com/pskillen/codeplug-studio/issues/110)

**Code:** `src/core/domain/channelNaming.ts`, `src/core/import-export/channelExpansion/shortenName.ts`, `exportWireNames.ts`, `talkGroupWireNames.ts`, `listWireNames.ts`, `multiMode.ts`, `multiTalkGroup.ts`, `multiTalkGroupWireName.ts`

## Pipeline

1. **Compose** — `composeChannelWireName` from callsign, name, and export name mode (browser fallback setting).
2. **Build override** — `channelOverrides.wireName` on the format build (if set).
3. **Multi-mode expansion** — per-mode suffix rows (`-F`, `-D`, `-Y`, `-DS`, …) when `expandModes` is true and multiple `modeProfiles` exist ([#89](https://github.com/pskillen/codeplug-studio/issues/89)).
4. **Multi-talkgroup expansion** (DM32-style formats) — `composeMultiTalkGroupWireName` + `applyMultiTalkGroupWireNameLimits` when RX group lists fan out to one row per member ([#110](https://github.com/pskillen/codeplug-studio/issues/110)); see [multi-talkgroup-expansion.md](../../reference/multi-talkgroup-expansion.md).
5. **Shorten** — `applyWireNameLimits` / `finalizeWireName` for channels; `applyTalkGroupWireNameLimits` for talk groups in `Contacts.csv` and FK columns when `shortenNames` is true and the name exceeds `maxNameLength`; `applyListWireNameLimits` for zone, scan list (Anytone), RX group list, and OpenGD77 private contact wire names at export and wire preview.
   - **Library abbrev:** when **Use abbreviations from library** is on (default), prefer `Channel.abbreviation` and `TalkGroup.abbreviation` before dictionary / vowel strategies; multi-mode suffixes (`-F`, `-D`, …) are preserved on channels. Multi-talkgroup **channel** suffixes use `talkGroupMemberSuffix` (legacy `append` mode) and `fixedSuffix` (TG-first compose modes) in `shortenWireName`. Regenerate `dictionary.generated.ts` via `npm run generate:abbreviations` (runs automatically before `test` and `build`).

## Operator settings

`ExportNameSettingsFields` on `/builds/:id/export` persists preferences in browser `localStorage` via `useExportSettings`:

| Key                                                 | Effect                                                                                                                  |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `codeplug-studio.export.shortenNames`               | Enable abbreviation shortening (default on)                                                                             |
| `codeplug-studio.export.maxNameLength`              | Override profile `nameLimit`                                                                                            |
| `codeplug-studio.export.nameModeOverride`           | Default name style when no build wire override is set                                                                   |
| `codeplug-studio.export.useChannelAbbreviation`     | Prefer `Channel.abbreviation` before dictionary shortening (default on); kept in sync with talk-group abbrev from UI    |
| `codeplug-studio.export.useTalkGroupAbbreviation`   | Prefer `TalkGroup.abbreviation` when shortening talk-group wire names and multi-talkgroup channel suffixes (default on) |
| `codeplug-studio.export.exportZoneDerivedScanLists` | Master toggle for DM32 zone-derived `Scan.csv` export (default on); per-zone flags on the Zones page still apply        |

**Use abbreviations from library** on the export panel and channel wire-preview page toggles both keys together on every format.

Wire preview and export share DM32 expansion: no multi-mode rows; RX-list fan-out when a channel references a multi-member RX group list.

## Related

- [wire-preview.md](wire-preview.md) — UI workflow
- [wire-name-composition.md](../builds/wire-name-composition.md) — traits → fields matrix for generated names
- [dm32-progress.md](dm32-progress.md) — DM32 export epic execution log ([#37](https://github.com/pskillen/codeplug-studio/issues/37))
- [OpenGD77 profiles](opengd77/README.md) — per-radio `nameLimit`
- [multi-talkgroup-expansion.md](../../reference/multi-talkgroup-expansion.md) — RX-list fan-out rules
- [DM32 talkgroups wire reference](../../reference/dm32/talkgroups.md) — CPS column detail (tier 3)
