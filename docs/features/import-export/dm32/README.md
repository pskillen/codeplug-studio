# Baofeng DM32 CSV — export

Product behaviour for Baofeng DM-32UV CPS CSV export in Codeplug Studio. Wire column tables live in the tier-3 [DM32 reference](../../../reference/dm32/README.md).

**Tracking:** Phase 5 export [#37](https://github.com/pskillen/codeplug-studio/issues/37) · Import [#112](https://github.com/pskillen/codeplug-studio/issues/112)

**Source:** `src/core/import-export/formats/dm32/`

**Progress:** [dm32-progress.md](../dm32-progress.md) · **Outstanding:** [dm32-outstanding.md](../dm32-outstanding.md)

## Implementation status

| Area                            | Status  | Notes                                                                                                                                         |
| ------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Radio profile + column scaffold | Shipped | [#114](https://github.com/pskillen/codeplug-studio/issues/114) — `profiles.ts`, `columns.ts`, fixtures                                        |
| Zone export trait layout        | Shipped | [#104](https://github.com/pskillen/codeplug-studio/issues/104) — flags on `ZoneGroupingLayout`, not library `Zone`                            |
| Multi-TG wire core + TG abbrev  | Shipped | [#110](https://github.com/pskillen/codeplug-studio/issues/110)                                                                                |
| Trait profile registration      | Shipped | `dm32-baofeng-dm32uv` in `TRAIT_PROFILES`                                                                                                     |
| Export adapter                  | Shipped | [#115](https://github.com/pskillen/codeplug-studio/issues/115) — [export-mapping.md](export-mapping.md)                                       |
| Zone-derived `Scan.csv`         | Shipped | [#129](https://github.com/pskillen/codeplug-studio/issues/129) — [zone-derived scan reference](../../../reference/zone-derived-scan-lists.md) |
| Build zone export UI            | Shipped | [#121](https://github.com/pskillen/codeplug-studio/issues/121) — [zone-grouping.md](../../builds/zone-grouping.md)                            |
| Export UI + wire preview        | Shipped | [#119](https://github.com/pskillen/codeplug-studio/issues/119) — multi-TG options, scan toggle, hide filter, fan-out display details          |
| Directional export tests        | Shipped | [#122](https://github.com/pskillen/codeplug-studio/issues/122) — [mapping-tests.md](../../../build/testing/mapping-tests.md)                  |
| CRLF export line endings        | Shipped | [#314](https://github.com/pskillen/codeplug-studio/issues/314) — Windows CPS import compatibility                                            |
| CPS import                      | Planned | [#112](https://github.com/pskillen/codeplug-studio/issues/112)                                                                                |

## Trait profile vs radio profile

| Concept           | Where                                           | Purpose                                                                                              |
| ----------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Trait profile** | `TRAIT_PROFILES` in `src/core/models/traits.ts` | Build capability traits: zone grouping, scan lists, m×n expansion                                    |
| **Radio profile** | `DM32_PROFILES` in `profiles.ts`                | Wire limits at the CPS boundary: channels, RX list members, scan list members, power/squelch ladders |

Both use profile id **`dm32-baofeng-dm32uv`**.

## Radio profile (tier 1 summary)

| Profile               | Label           | Channel cap | RX list members | Scan list members | Name limit |
| --------------------- | --------------- | ----------- | --------------- | ----------------- | ---------- |
| `dm32-baofeng-dm32uv` | Baofeng DM-32UV | 1000        | 32              | 16                | 16         |

Per-radio wire detail: [docs/reference/dm32/radios/](../../../reference/dm32/radios/README.md).

## Expandable channels (DM32 vs OpenGD77)

| Axis            | DM32                                                                      | OpenGD77                          |
| --------------- | ------------------------------------------------------------------------- | --------------------------------- |
| Multi-mode      | Native `Fixed Analog` / `Fixed Digital` on one row (`expandModes: false`) | Separate `-F`/`-D` rows           |
| Multi-talkgroup | Flat per-TG channel rows (`expandRxGroupLists: true`)                     | Native `TG List` + `TG_Lists.csv` |

See [name-shortening.md](../name-shortening.md) and [dm32/multi-talkgroup.md](../../../reference/dm32/multi-talkgroup.md).

## Zone export knobs (build layout)

DM32 scratch channel, scan-list export, and scan carrier frequency live on **`FormatBuild.layout`** zone grouping entries (`exportScratchChannel`, `exportScanList`, `scanCarrierFrequencyHz`) — not on library zones ([#104](https://github.com/pskillen/codeplug-studio/issues/104)). Per-member scan inclusion is vendor-neutral on library `Zone.members` (`includeInScanList`). Operator workflow: [zone-grouping.md](../../builds/zone-grouping.md).

## Deferrals

| Item                             | Tracking                                                                |
| -------------------------------- | ----------------------------------------------------------------------- |
| `Scan.csv` import                | [#112](https://github.com/pskillen/codeplug-studio/issues/112) or later |
| `DMR-ID.csv` / channel `DMR ID`  | Accepted lossy gap — profile default label on export                    |
| `exportScratchChannel` serialise | UI flag only until wire behaviour ships                                 |
| Manual scan-list CRUD            | Future                                                                  |

## Related

- [import-export hub](../README.md)
- [builds hub](../../builds/README.md)
- [data-model](../../data-model/README.md)
- [cps-services.md](../cps-services.md)
- [name-shortening.md](../name-shortening.md)
