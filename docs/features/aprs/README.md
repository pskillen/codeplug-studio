# APRS (digital)

Tier-1 hub for **digital APRS** in Codeplug Studio — vendor-neutral library entities, per-channel bindings, and build-scoped active configuration selection. Wire column mapping lives in per-format tier-3 references; this doc describes internal semantics only.

**Tracking:** [#353](https://github.com/pskillen/codeplug-studio/issues/353) (persistence) · [#354](https://github.com/pskillen/codeplug-studio/issues/354) (UI) · [#248](https://github.com/pskillen/codeplug-studio/issues/248) (reconciliation) · Epic [#246](https://github.com/pskillen/codeplug-studio/issues/246)

**Progress:** [aprs-model-progress.md](aprs-model-progress.md) · **Outstanding:** [aprs-model-outstanding.md](aprs-model-outstanding.md)

**Components:** [AprsChannelSlotsEditor](../../../src/app/components/library/AprsChannelSlotsEditor.md) · [ChannelAprsBindingSection](../../../src/app/components/library/ChannelAprsBindingSection.md) · [BuildAprsSettingsSection](../../../src/app/components/builds/BuildAprsSettingsSection.md)

---

## Scope

| In scope (this epic)                                                                      | Out of scope                                                                                                                                                               |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Digital DMR-over-APRS configuration and per-channel flags                                 | Analog (AX.25) APRS — not modelled; exporters emit off/default constants                                                                                                   |
| Library `AprsConfiguration[]` + `Channel.aprs?` + `FormatBuild.activeAprsConfigurationId` | OpenGD77 APRS (analog-only) — deferred                                                                                                                                     |
| Native YAML persistence + domain validation                                               | CPS export serialisation — [#251](https://github.com/pskillen/codeplug-studio/issues/251) (Anytone), [#250](https://github.com/pskillen/codeplug-studio/issues/250) (DM32) |
| IndexedDB `aprsConfigurations` store (schema v16)                                         |                                                                                                                                                                            |
| Library list/editor, channel APRS tab, build active-config picker (Anytone D890)          |                                                                                                                                                                            |
| Cross-format reconciliation doc                                                           |                                                                                                                                                                            |

**Analog-off export policy:** Anytone and DM32 analog APRS columns are not operator-editable. Export adapters fill them with fixture constants (`Off`, `0`, …) regardless of stale library data.

---

## Entities (summary)

| Entity                      | Layer                       | Role                                                                                                         |
| --------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `AprsConfiguration`         | Library                     | Global digital APRS settings — beacon timing, position source, up to 8 DMR channel slots, default DMR target |
| `ChannelAprsBinding`        | Library (on `Channel.aprs`) | Per-channel digital flags — receive, report type, PTT mode, report channel ref                               |
| `activeAprsConfigurationId` | Format build                | Selects which library config serialises as the single global row (Anytone `APRS.CSV`)                        |

Deep field semantics: [data-model README](../data-model/README.md). Cross-format wire shapes: [cross-format-reconciliation.md](cross-format-reconciliation.md).

**No new build trait** — APRS does not change zone/scan/memory organisation.

**No radio caps in CRUD** — slot cardinality (e.g. 8 on AT-D890UV) is enforced at export with warnings only, matching `ScanList` patterns.

---

## Implementation status

| Area                                                         | Status                                                                   |
| ------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Tier-1 + reconciliation docs                                 | Shipped ([#248](https://github.com/pskillen/codeplug-studio/issues/248)) |
| Core types + schema v15                                      | Shipped ([#249](https://github.com/pskillen/codeplug-studio/issues/249)) |
| Domain normalize / validation / slot resolver                | Shipped                                                                  |
| `assemble()` APRS projection                                 | Shipped                                                                  |
| Native YAML round-trip                                       | Shipped                                                                  |
| IndexedDB persistence (`aprsConfigurations`, schema v16)     | Shipped ([#353](https://github.com/pskillen/codeplug-studio/issues/353)) |
| Library/build APRS UI                                        | Shipped ([#354](https://github.com/pskillen/codeplug-studio/issues/354)) |
| Anytone export (`APRS.CSV`, channel cols, `aprsDefaults.ts`) | Pending — [#251](https://github.com/pskillen/codeplug-studio/issues/251) |
| DM32 per-channel APRS                                        | Pending — [#250](https://github.com/pskillen/codeplug-studio/issues/250) |

---

## Related

- [data-model](../data-model/README.md) — ER diagram and entity tables
- [Anytone APRS wire inventory](../../reference/anytone/aprs.md) — tier 3
- [Anytone per-channel APRS](../../reference/anytone/aprs-on-channels.md) — tier 3
