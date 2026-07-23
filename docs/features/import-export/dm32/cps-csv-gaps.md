# Baofeng DM32 CPS CSV — gaps (parked)

Variance and debt report for **stock Baofeng DM-32UV CPS CSV** export vs what we now know from **NeonPlug DM32UV** (working radio path) and the [#404](https://github.com/pskillen/codeplug-studio/issues/404) wire-elicitation pass.

**Product stance (2026-07):** Prefer [NeonPlug](../neonplug/README.md) (`.neonplug` merge-export) for writing the radio. Stock CPS CSV remains available for interop, fixtures, and archival reference, but **further CPS fidelity work is parked** — Baofeng CPS import/round-trip is unreliable, and NeonPlug already delivers a working end-to-end path.

**Purpose:** Leave a single convertible backlog. Rows may become GitHub tickets under [#503](https://github.com/pskillen/codeplug-studio/issues/503) later — or stay accepted loss. Do **not** treat this file as an active sprint plan.

**Tier-3 wire tables:** [docs/reference/export-formats/dm32/](../../../reference/export-formats/dm32/README.md) · worksheet (frozen): [enum-verification.md](../../../reference/export-formats/dm32/enum-verification.md)  
**NeonPlug sibling (same radio family, different wire):** [docs/reference/export-formats/neonplug/](../../../reference/export-formats/neonplug/README.md) · [neonplug profiles.md](../../../reference/export-formats/neonplug/profiles.md) (`neonplug-dm32uv`)

---

## Executive summary

| Priority | Topic                                                                  | Status                                                                                                                                                                                                                                                                       |
| -------: | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|    **—** | Operator path for radio write                                          | **NeonPlug preferred** — UI warning shipped ([#556](https://github.com/pskillen/codeplug-studio/issues/556))                                                                                                                                                                 |
|   **P0** | Scan Name / member / trailing `\|` caps                                | **Shipped** on CSV ([#485](https://github.com/pskillen/codeplug-studio/issues/485)–[#487](https://github.com/pskillen/codeplug-studio/issues/487), [#547](https://github.com/pskillen/codeplug-studio/pull/547)) — aligned with NeonPlug LIMITS                              |
|   **P0** | Empty / zero-member `Scan.csv` floor                                   | **Shipped** ([#564](https://github.com/pskillen/codeplug-studio/issues/564) / PRs [#566](https://github.com/pskillen/codeplug-studio/pull/566)–[#567](https://github.com/pskillen/codeplug-studio/pull/567))                                                                 |
|   **P1** | Scan names empty/garbled in CPS after import                           | **Open** [#478](https://github.com/pskillen/codeplug-studio/issues/478) — strongest evidence CPS is a dead end; **park** unless someone needs CSV→CPS display                                                                                                                |
|   **P2** | TX Admit / RX Squelch / Fixed Analog / Scan constants / DMR ID default | **Open** elicitation tickets [#445](https://github.com/pskillen/codeplug-studio/issues/445)–[#451](https://github.com/pskillen/codeplug-studio/issues/451), [#446](https://github.com/pskillen/codeplug-studio/issues/446) — **park**; NeonPlug does not use these CSV enums |
|   **P2** | Full CPS enum worksheet completion                                     | **Parked** — [enum-verification.md](../../../reference/export-formats/dm32/enum-verification.md) kept as partial inventory                                                                                                                                                   |
|   **P3** | CPS CSV **import**                                                     | Planned under [#112](https://github.com/pskillen/codeplug-studio/issues/112) / [#503](https://github.com/pskillen/codeplug-studio/issues/503) — deprioritised vs NeonPlug import                                                                                             |

---

## Why park CPS CSV fidelity

| Observation                                                                                                                                                  | Implication                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| CPS import of Studio `Scan.csv` can show **blank / garbled** scan names on CPS UI and radio ([#478](https://github.com/pskillen/codeplug-studio/issues/478)) | CSV→CPS is not a trustworthy flash path even when Studio export is “structurally correct”   |
| CPS marketing/docs disagree with wire (e.g. “16” scan members vs **15** retained; Scan Name ~11 vs radio/NeonPlug field **10**)                              | Elicitation cost is high; caps are already mirrored from NeonPlug LIMITS into both profiles |
| NeonPlug DM32UV export + merge path **ships** and writes the radio                                                                                           | Operator value is on `.neonplug`, not stock CPS ZIP                                         |
| Studio already warns on DM32 CSV export                                                                                                                      | Product messaging matches this gaps stance                                                  |

CSV export stays: directional tests, `cps-verify`, sample-codeplugs, and operators who still need CPS files for other tools.

---

## Learnings from NeonPlug (apply to CPS docs / caps)

These are **already reflected** (or should stay in sync) between `dm32-baofeng-dm32uv` and `neonplug-dm32uv` profiles — keep them aligned; do not invent CPS-only caps.

| Topic                               | NeonPlug / radio fact                                    | CPS CSV consequence                                                                                                      |
| ----------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Channel / zone / contact / TG names | **16**                                                   | Same `nameLimit`                                                                                                         |
| Scan list names                     | **10** (NeonPlug field; CPS official ~11)                | `scanListNameLimit: 10`                                                                                                  |
| RX group list names                 | **10**                                                   | `rxGroupListNameLimit: 10`                                                                                               |
| Zone members                        | **64**                                                   | Zone pipe lists may be long; **scan** still truncates to 15                                                              |
| Scan list members                   | **15** named (16th = implicit current channel in CPS UI) | `scanListMembers: 15` + warning                                                                                          |
| Scan membership FK                  | NeonPlug: **channel numbers**; CPS: **name** FKs         | Different wire worlds — never share FK strategies                                                                        |
| Empty scan region                   | NeonPlug strips empty lists → Studio floors ≥1 member    | CPS `Scan.csv` floors the same way for ZIP consistency                                                                   |
| Trailing `\|` on scan members       | CPS sample / re-export style                             | Studio Scan.csv emits terminator; **Zones.csv does not**                                                                 |
| APRS                                | NeonPlug: `radioSettings` patch + channel fields         | CPS: channel columns + operator `APRS.md` guide (no `APRS.csv`)                                                          |
| Contacts metadata                   | NeonPlug contact book fields                             | CPS `Contacts.csv` City/Province/Country/Remark shipped ([#448](https://github.com/pskillen/codeplug-studio/issues/448)) |
| m×n + scratch                       | Shared `expandAllMxNChannels` (`channelExpansion/mxnExpandAll.ts`) | Both formats + Web Serial consume the same radio-target projection ([#664](https://github.com/pskillen/codeplug-studio/issues/664)) |

Profile sync test: `formats/neonplug/profiles.test.ts` (caps must not drift).

---

## Shipped on CPS CSV (keep)

| Item                                                    | Ticket / PR                                                                                                                                                                                 |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core Channels/Zones/Talkgroups/Contacts/RGL/DTMF export | Epic [#37](https://github.com/pskillen/codeplug-studio/issues/37) / [#503](https://github.com/pskillen/codeplug-studio/issues/503)                                                          |
| Zone-derived `Scan.csv` + carrier                       | [#129](https://github.com/pskillen/codeplug-studio/issues/129)                                                                                                                              |
| CRLF                                                    | [#314](https://github.com/pskillen/codeplug-studio/issues/314)                                                                                                                              |
| Contacts metadata                                       | [#448](https://github.com/pskillen/codeplug-studio/issues/448)                                                                                                                              |
| Scratch companions                                      | [#140](https://github.com/pskillen/codeplug-studio/issues/140)                                                                                                                              |
| APRS channel columns + `APRS.md`                        | [#250](https://github.com/pskillen/codeplug-studio/issues/250)                                                                                                                              |
| Scan Name ≤10, members ≤15, trailing `\|`               | [#485](https://github.com/pskillen/codeplug-studio/issues/485)–[#487](https://github.com/pskillen/codeplug-studio/issues/487), [#547](https://github.com/pskillen/codeplug-studio/pull/547) |
| Empty scan floor                                        | [#564](https://github.com/pskillen/codeplug-studio/issues/564)                                                                                                                              |
| Docs drift vs adapter                                   | [#444](https://github.com/pskillen/codeplug-studio/issues/444)                                                                                                                              |
| Prefer-NeonPlug UI                                      | [#556](https://github.com/pskillen/codeplug-studio/issues/556)                                                                                                                              |

---

## Parked backlog (convertible to tickets)

Do **not** file by default. Promote only if someone needs stock CPS CSV as a primary flash path again.

| ID      | Sketch                                                                                                      | Existing issue                                                 | Notes                                            |
| ------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------ |
| **G1**  | Scan names blank/garbled after CPS import                                                                   | [#478](https://github.com/pskillen/codeplug-studio/issues/478) | Highest-value CPS bug if CSV path is revived     |
| **G2**  | TX Admit full CPS enum                                                                                      | [#445](https://github.com/pskillen/codeplug-studio/issues/445) | Cascade maps two values; elicit rest             |
| **G3**  | Neutral `defaultDmrIdLabel` (remove personal fixture string)                                                | [#446](https://github.com/pskillen/codeplug-studio/issues/446) | Product hygiene — small; safe to do anytime      |
| **G4**  | Scan.csv synthesised constants vs CPS                                                                       | [#447](https://github.com/pskillen/codeplug-studio/issues/447) | Hang time / Tx mode / Talkback / typo “Actived”  |
| **G5**  | Richer v1.60 fixture rows                                                                                   | [#449](https://github.com/pskillen/codeplug-studio/issues/449) | Fixed Analog, DCS, squelch ladder, scan variants |
| **G6**  | RX Squelch Mode Carrier vs Carrier/CTC                                                                      | [#450](https://github.com/pskillen/codeplug-studio/issues/450) |                                                  |
| **G7**  | Fixed Analog Channel Type + fixture                                                                         | [#451](https://github.com/pskillen/codeplug-studio/issues/451) |                                                  |
| **G8**  | Finish [enum-verification.md](../../../reference/export-formats/dm32/enum-verification.md) Observed columns | [#404](https://github.com/pskillen/codeplug-studio/issues/404) | Parked elicitation                               |
| **G9**  | CPS CSV import                                                                                              | [#112](https://github.com/pskillen/codeplug-studio/issues/112) | Prefer NeonPlug import epic instead              |
| **G10** | `DMR-ID.csv` export                                                                                         | —                                                              | Accepted skip unless CPS proven to require it    |

**Small hygiene candidate (optional anytime):** **G3** (#446) — does not require CPS elicitation.

---

## CPS vs NeonPlug — do not conflate

| Concern                       | CPS CSV                  | NeonPlug `.neonplug`               |
| ----------------------------- | ------------------------ | ---------------------------------- |
| Relationship keys             | Case-sensitive **names** | **Channel numbers** / list indexes |
| Container                     | Multi-file ZIP of CSVs   | Single ZIP → `codeplug.json`       |
| Radio settings / APRS globals | Lossy / `APRS.md` guide  | Merge + `radioSettings` patch      |
| Flash path                    | CPS software (fragile)   | NeonPlug app (preferred)           |
| Studio profile id             | `dm32-baofeng-dm32uv`    | `neonplug-dm32uv`                  |

---

## Related

- Feature hub: [dm32/README.md](README.md)
- NeonPlug hub: [neonplug/README.md](../neonplug/README.md)
- Anytone sibling pattern: [csv-reconciliation-gaps.md](../anytone/csv-reconciliation-gaps.md)
- Tracking: [#404](https://github.com/pskillen/codeplug-studio/issues/404) · epic [#503](https://github.com/pskillen/codeplug-studio/issues/503)
