# OpenGD77 CSV — outstanding

Items **skipped**, **incomplete**, or **discovered during execution** — not the plan's future phases.

**Tracking:** [#36](https://github.com/pskillen/codeplug-studio/issues/36) · branch `87/pskil/build-wire-preview`

---

## Pre-existing model debt

- [ ] ~~Library `Zone` carries OpenGD77-shaped export fields~~ — moved to `ZoneGroupingLayout` on DM32 builds ([#104](https://github.com/pskillen/codeplug-studio/issues/104))
- [ ] **Model review** — [#99](https://github.com/pskillen/codeplug-studio/issues/99) audit `FormatBuild`, `ZoneGroupingLayout`, trait flags, and composite expansion override keys after wire-preview ship

---

## Wire preview scope ([#87](https://github.com/pskillen/codeplug-studio/issues/87) / [#89](https://github.com/pskillen/codeplug-studio/issues/89) / [#90](https://github.com/pskillen/codeplug-studio/issues/90))

Shipped on `87/pskil/build-wire-preview`:

- Build sub-routes with `WirePreviewTable` and sparse `*Overrides`
- Zone grouping layout editor on `/builds/:id/zones`
- Multi-mode `-F`/`-D` expansion at preview + export
- Export name shortening + `ExportNameSettingsFields` on export page

Deferred / follow-on (not blocking merge):

- IndexedDB read-path migration for legacy `*Selections` whitelist rows (YAML import + `assemble` migrate on load)
- DM32-style multi-talkgroup abbreviation UI (`showMultiTalkGroupOptions`) when that format ships — superseded by unified **Use abbreviations from library** ([#300](https://github.com/pskillen/codeplug-studio/issues/300) / [#301](https://github.com/pskillen/codeplug-studio/issues/301))
