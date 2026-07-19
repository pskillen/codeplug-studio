# Baofeng DM32 CSV export — progress

**Epic:** [#37](https://github.com/pskillen/codeplug-studio/issues/37) (Phase 5 — DM32 CSV **export**)  
**Import epic:** [#112](https://github.com/pskillen/codeplug-studio/issues/112) (Phase 5b)  
**Hub:** [dm32/README.md](dm32/README.md)  
**Tier-3 wire reference:** [docs/reference/dm32/](../../reference/dm32/README.md)  
**Archive reference:** [codeplug-tool#67](https://github.com/pskillen/codeplug-tool/issues/67)

---

## Overall status

**Status:** Complete — DM32 export epic closed 2026-07-03  
**Branch / PR:** `115/pskil/dm32-export`

| Phase                            | Issue                                                          | Status   | Notes                                      |
| -------------------------------- | -------------------------------------------------------------- | -------- | ------------------------------------------ |
| TG abbrev + multi-TG wire core   | [#110](https://github.com/pskillen/codeplug-studio/issues/110) | Complete | Shipped                                    |
| Zone export trait refactor       | [#104](https://github.com/pskillen/codeplug-studio/issues/104) | Complete | PR #136 foundation                         |
| Feature hub README               | [#113](https://github.com/pskillen/codeplug-studio/issues/113) | Complete | [dm32/README.md](dm32/README.md)           |
| Profiles + columns + fixtures    | [#114](https://github.com/pskillen/codeplug-studio/issues/114) | Complete | `formats/dm32/`, `test-data/baofeng-dm32/` |
| Export adapter                   | [#115](https://github.com/pskillen/codeplug-studio/issues/115) | Complete | `115/pskil/dm32-export`                    |
| Zone-derived scan lists          | [#129](https://github.com/pskillen/codeplug-studio/issues/129) | Complete | Schema v5, `zoneDerivedScanLists/`         |
| Zone export trait UI             | [#121](https://github.com/pskillen/codeplug-studio/issues/121) | Complete | Build zones page controls                  |
| Export UI + wire preview fan-out | [#119](https://github.com/pskillen/codeplug-studio/issues/119) | Complete | Export panel + channel fan-out preview     |
| Directional export tests         | [#122](https://github.com/pskillen/codeplug-studio/issues/122) | Complete | `dm32CsvCompare`, minimal golden bundle    |
| Export epic closeout docs        | [#123](https://github.com/pskillen/codeplug-studio/issues/123) | Complete | This log + hub reconciliation              |

**Import (Phase 5b — [#112](https://github.com/pskillen/codeplug-studio/issues/112)):** [#124](https://github.com/pskillen/codeplug-studio/issues/124)–[#128](https://github.com/pskillen/codeplug-studio/issues/128) — unblocked on export scaffold.

---

## Slice — Export foundation ([#104](https://github.com/pskillen/codeplug-studio/issues/104), [#114](https://github.com/pskillen/codeplug-studio/issues/114), [#113](https://github.com/pskillen/codeplug-studio/issues/113))

**Status:** Complete — merged via PR #136

---

## Slice — Export adapter ([#115](https://github.com/pskillen/codeplug-studio/issues/115))

**Status:** Complete  
**Commit:** `feat(dm32): export adapter and serialise from assemble`

---

## Slice — Zone-derived scan ([#129](https://github.com/pskillen/codeplug-studio/issues/129))

**Status:** Complete  
**Commit:** `feat(dm32): zone-derived scan list export synthesis`

---

## Slice — Zone export trait UI ([#121](https://github.com/pskillen/codeplug-studio/issues/121))

**Status:** Complete  
**Commit:** `feat(ui): DM32 build zone export trait controls`

---

## Slice — Export UI + wire preview ([#119](https://github.com/pskillen/codeplug-studio/issues/119))

**Status:** Complete  
**Commit:** `feat(ui): DM32 export settings and wire preview fan-out`

---

## Slice — Directional tests ([#122](https://github.com/pskillen/codeplug-studio/issues/122))

**Status:** Complete  
**Commit:** `test(dm32): directional export tests and registry verification`

---

## Next

Import epic [#112](https://github.com/pskillen/codeplug-studio/issues/112) — DM32 CPS import (Phase 5b).

---

## Post-epic — wire preview polish (PR #137 follow-up, 2026-07-03)

**Status:** Complete on `115/pskil/dm32-export`

| Slice                        | Commit                                                            | Notes                                                          |
| ---------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------- |
| DM32 fan-out display details | `feat(ui): DM32 wire preview expansion display details`           | Channel + TG sub-lines under display name                      |
| Export hide toggle           | `feat(ui): hide wire preview rows omitted from export`            | Per-entity table switch + export inclusion explainer           |
| Library zone linkage         | `fix(builds): honour library zone members in export hide filter`  | Legacy `Zone.members` refs; `zoneLinkedChannelIds`             |
| Multi-TG wire token          | `fix(multi-tg): omit timeslot from suffix number wire token`      | `suffix_tg_number` uses TG ID only                             |
| Wire name composition hub    | `docs(builds): add wire name composition reference hub`           | [wire-name-composition.md](../builds/wire-name-composition.md) |
| Hide toggle filter fix       | `fix(builds): wire preview hide toggle filters per-row inclusion` | `isPreviewRowIncludedInExport`; DM32 orphan rows in preview    |

---

## Post-epic — list name shortening ([#301](https://github.com/pskillen/codeplug-studio/issues/301))

**Status:** Complete  
**Branch:** `300-301/pskil/list-name-shortening`

| Slice                                  | Notes                                            |
| -------------------------------------- | ------------------------------------------------ |
| Zone / RX group list export shortening | `buildListWireNameMap` in `serialise.ts` context |
| Wire preview                           | Zones and RX group lists at profile `nameLimit`  |
| Library abbrev UI                      | Unified toggle with OpenGD77 / Anytone / CHIRP   |

---

## Post-epic — Scan.csv wire fixes ([#485](https://github.com/pskillen/codeplug-studio/issues/485)–[#487](https://github.com/pskillen/codeplug-studio/issues/487))

**Status:** Complete  
**Branch:** `485/pskil/dm32-scan-wire-fixes`

| Issue                                                          | Fix                                     | Notes                                                            |
| -------------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------- |
| [#486](https://github.com/pskillen/codeplug-studio/issues/486) | `scanListMembers: 15`                   | CPS “16” includes implicit current channel                       |
| [#487](https://github.com/pskillen/codeplug-studio/issues/487) | Trailing `\|` on Scan `Channel Members` | Zones remain without trailing pipe                               |
| [#485](https://github.com/pskillen/codeplug-studio/issues/485) | `scanListNameLimit: 13`                 | Scan Name + carrier `Scan List` FK; general `nameLimit` stays 16 |
