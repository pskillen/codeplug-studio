# Baofeng DM32 CSV — export

Product behaviour for Baofeng DM-32UV CPS CSV export in Codeplug Studio. Wire column tables live in the tier-3 [DM32 reference](../../../reference/export-formats/dm32/README.md).

**Tracking:** Epic [#503](https://github.com/pskillen/codeplug-studio/issues/503) (import + export; supersedes M1 [#37](https://github.com/pskillen/codeplug-studio/issues/37) / [#112](https://github.com/pskillen/codeplug-studio/issues/112)) · import [#124](https://github.com/pskillen/codeplug-studio/issues/124)–[#128](https://github.com/pskillen/codeplug-studio/issues/128)

**Source:** `src/core/import-export/formats/dm32/`

## Implementation status

| Area                            | Status  | Notes                                                                                                                                                                                                                         |
| ------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Radio profile + column scaffold | Shipped | [#114](https://github.com/pskillen/codeplug-studio/issues/114) — `profiles.ts`, `columns.ts`, fixtures                                                                                                                        |
| Zone export trait layout        | Shipped | [#104](https://github.com/pskillen/codeplug-studio/issues/104) — flags on `ZoneGroupingLayout`, not library `Zone`                                                                                                            |
| Multi-TG wire core + TG abbrev  | Shipped | [#110](https://github.com/pskillen/codeplug-studio/issues/110)                                                                                                                                                                |
| Trait profile registration      | Shipped | `dm32-baofeng-dm32uv` in `TRAIT_PROFILES`                                                                                                                                                                                     |
| Export adapter                  | Shipped | [#115](https://github.com/pskillen/codeplug-studio/issues/115) — [export-mapping.md](export-mapping.md)                                                                                                                       |
| Zone-derived `Scan.csv`         | Shipped | [#129](https://github.com/pskillen/codeplug-studio/issues/129) — [zone-derived scan reference](../../../reference/zone-derived-scan-lists.md); ≥1-member floor [#564](https://github.com/pskillen/codeplug-studio/issues/564) |
| Build zone export UI            | Shipped | [#121](https://github.com/pskillen/codeplug-studio/issues/121) — [zone-grouping.md](../../builds/zone-grouping.md)                                                                                                            |
| Export UI + wire preview        | Shipped | [#119](https://github.com/pskillen/codeplug-studio/issues/119) — multi-TG options, scan toggle, hide filter, fan-out display details                                                                                          |
| Directional export tests        | Shipped | [#122](https://github.com/pskillen/codeplug-studio/issues/122) — [mapping-tests.md](../../../build/testing/mapping-tests.md)                                                                                                  |
| Contacts.csv metadata           | Shipped | [#448](https://github.com/pskillen/codeplug-studio/issues/448) — City/Province/Country/Remark from `DigitalContact`                                                                                                           |
| Per-repeater scratch channels   | Shipped | [#140](https://github.com/pskillen/codeplug-studio/issues/140) — [export-projections.md](export-projections.md)                                                                                                               |
| CRLF export line endings        | Shipped | [#314](https://github.com/pskillen/codeplug-studio/issues/314) — Windows CPS import compatibility                                                                                                                             |
| APRS channel cols + `APRS.md`   | Shipped | [#250](https://github.com/pskillen/codeplug-studio/issues/250) — [aprs.md](../../../reference/export-formats/dm32/aprs.md)                                                                                                           |
| Prefer-NeonPlug export warning  | Shipped | [#556](https://github.com/pskillen/codeplug-studio/issues/556) — orange alert at top of export panel and again above download buttons; New build format/profile pills; CSV download remains available                         |
| CPS import                      | Planned | [#112](https://github.com/pskillen/codeplug-studio/issues/112)                                                                                                                                                                |

## Trait profile vs radio profile

| Concept           | Where                                           | Purpose                                                                                              |
| ----------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Trait profile** | `TRAIT_PROFILES` in `src/core/models/traits.ts` | Build capability traits: zone grouping, scan lists, m×n expansion                                    |
| **Radio profile** | `DM32_PROFILES` in `profiles.ts`                | Wire limits at the CPS boundary: channels, RX list members, scan list members, power/squelch ladders |

Both use profile id **`dm32-baofeng-dm32uv`**.

## Radio profile (tier 1 summary)

| Profile               | Label           | Channel cap | Zone members | RX list members | Scan list members | Name limit | Scan Name limit | RGL name limit |
| --------------------- | --------------- | ----------- | ------------ | --------------- | ----------------- | ---------- | --------------- | -------------- |
| `dm32-baofeng-dm32uv` | Baofeng DM-32UV | 4000        | 64           | 32              | 15                | 16         | 10              | 10             |

Scan list CSV members are capped at **15** named entries (CPS “16” includes an implicit current-channel slot). Zone membership allows **64** members — zone-derived scan export truncates to 15. General LCD/`nameLimit` remains **16** for channels and zones; `Scan.csv` `Scan Name` and RX group list names use **10** — see [scan-lists.md](../../../reference/export-formats/dm32/scan-lists.md) and [dm-32uv](../../../reference/radios/baofeng/dm-32uv/README.md) · [dm32 profiles.md](../../../reference/export-formats/dm32/profiles.md).

Per-radio map: [dm32 profiles.md](../../../reference/export-formats/dm32/profiles.md) → [`docs/reference/radios/`](../../../reference/radios/).

## Prefer NeonPlug for radio write

Baofeng DM-32 CPS CSV import is unreliable. On `/builds/:id/export` for a DM32 build, Studio shows a strong warning to prefer a [NeonPlug](../neonplug/README.md) build and `.neonplug` merge-on-export path. DM32 CSV download stays available for interop and fixtures.

**Parked CPS fidelity work:** [cps-csv-gaps.md](cps-csv-gaps.md) (from [#404](https://github.com/pskillen/codeplug-studio/issues/404)) — open elicitation tickets remain convertible; do not treat blank [enum-verification](../../../reference/export-formats/dm32/enum-verification.md) Observed cells as blockers.

## Expandable channels (DM32 vs OpenGD77)

| Axis            | DM32                                                                      | OpenGD77                          |
| --------------- | ------------------------------------------------------------------------- | --------------------------------- |
| Multi-mode      | Native `Fixed Analog` / `Fixed Digital` on one row (`expandModes: false`) | Separate `-F`/`-D` rows           |
| Multi-talkgroup | Flat per-TG channel rows (`expandRxGroupLists: true`)                     | Native `TG List` + `TG_Lists.csv` |

See [name-shortening.md](../name-shortening.md) and [dm32/multi-talkgroup.md](../../../reference/export-formats/dm32/multi-talkgroup.md).

## Zone export knobs (build layout)

DM32 scan-list export and scan carrier frequency live on **`FormatBuild.layout`** zone grouping entries (`exportScanList`, `scanCarrierFrequencyHz`) — not on library zones ([#104](https://github.com/pskillen/codeplug-studio/issues/104)). Per-member scan inclusion is vendor-neutral on library `Zone.members` (`includeInScanList`). Scratch companions use build **`exportSettings.exportScratchChannels`** ([#140](https://github.com/pskillen/codeplug-studio/issues/140)) — see [export-projections.md](export-projections.md). Operator workflow: [zone-grouping.md](../../builds/zone-grouping.md).

## Deferrals

| Item                            | Tracking                                                                |
| ------------------------------- | ----------------------------------------------------------------------- |
| `Scan.csv` import               | [#112](https://github.com/pskillen/codeplug-studio/issues/112) or later |
| `DMR-ID.csv` / channel `DMR ID` | Accepted lossy gap — profile default label on export                    |
| Manual scan-list CRUD           | Future                                                                  |

## Related

- [export-projections.md](export-projections.md) — m×n + scratch
- [cps-csv-gaps.md](cps-csv-gaps.md) — parked CPS CSV fidelity + NeonPlug learnings
- [import-export hub](../README.md)
- [neonplug hub](../neonplug/README.md) — preferred radio write
- [builds hub](../../builds/README.md)
- [data-model](../../data-model/README.md)
- [cps-services.md](../cps-services.md)
- [name-shortening.md](../name-shortening.md)
