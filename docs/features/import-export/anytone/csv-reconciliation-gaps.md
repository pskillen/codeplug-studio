# Anytone CSV reconciliation — gaps

Variance report: **Codeplug Studio** Anytone export adapter vs **operator AT-D890UV CPS export-all** (`D890 codeplug export`, 2026-07), updated after wire gap elicitation ([#357](https://github.com/pskillen/codeplug-studio/issues/357)).

Earlier single-build comparison: [tmp/export-variance-report.md](../../../../tmp/export-variance-report.md) (Studio export vs minimal official sample).

**Purpose:** Track wire-format mismatches. Tier-3 column detail stays in [docs/reference/formats/anytone/](../../../reference/formats/anytone/README.md) — especially [enum-verification.md](../../../reference/formats/anytone/enum-verification.md).

---

## Executive summary

| Priority | Gap                                  | Status after [#357](https://github.com/pskillen/codeplug-studio/issues/357)                                                                                                               |
| -------: | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   **P0** | `DMRDigitalContactList.CSV` headers  | **Fixed** ([#297](https://github.com/pskillen/codeplug-studio/issues/297)) — 10 columns                                                                                                   |
|    **—** | `Channel.CSV` VFO rows `4001`/`4002` | **Non-issue** — CPS adds VFO rows on import; Studio need not emit                                                                                                                         |
|   **P1** | `AMZone.CSV` + airband partition     | **Shipped** ([#316](https://github.com/pskillen/codeplug-studio/issues/316))                                                                                                              |
|   **P1** | `DMR MODE` / duplex                  | **Shipped** `0`/`1` ([#311](https://github.com/pskillen/codeplug-studio/issues/311)); `2`/`3` DCDM documented, unsupported export                                                         |
|   **P1** | Channel TX contact from RGL          | **Open question** — operator unsure; leave in outstanding, no ticket yet                                                                                                                  |
|   **P2** | Power ladder Mid / Turbo             | **Shipped** ([#391](https://github.com/pskillen/codeplug-studio/issues/391))                                                                                                              |
|   **P2** | ScanList timing / Scan Mode          | Timing defaults → all `5.0` in [#402](https://github.com/pskillen/codeplug-studio/issues/402); Scan Mode readiness remains [#393](https://github.com/pskillen/codeplug-studio/issues/393) |
|   **P2** | Enum / constant tail columns         | Elicited — see [enum-verification.md](../../../reference/formats/anytone/enum-verification.md)                                                                                            |
|   **P2** | Sidecar CPS files                    | Skip / future epics (OptionalSetting, HotKey, roaming, NXDN)                                                                                                                              |
|    **—** | Inventory / doc drift vs adapter     | Corrected in [#402](https://github.com/pskillen/codeplug-studio/issues/402) mop-up                                                                                                        |

Cross-file name FK issues from the earlier variance report were addressed in [#292](https://github.com/pskillen/codeplug-studio/issues/292).

---

## File inventory

|                      Metric |                                                                              Studio MVP |                   Operator rich export |
| --------------------------: | --------------------------------------------------------------------------------------: | -------------------------------------: |
|           CSV files emitted |                                           7 DMR + `AMAir.CSV` / `FM.CSV` when non-empty |                                     38 |
|                    Manifest | `{project}.LST` in ZIP ([#289](https://github.com/pskillen/codeplug-studio/issues/289)) |              `mm9pdy.LST` (38 entries) |
|          `Channel.CSV` rows |                                                                Programmed channels only | 100 programmed + 2 VFO (`4001`–`4002`) |
| `DMRDigitalContactList.CSV` |                                                         10-col header + serialised body |         10 cols; 1 private-contact row |
|              `ScanList.CSV` |                                                               When build has scan lists |     2 scan lists in operator re-export |

### Studio MVP files — header comparison

| File                            | Header match                                                              | Notes                                                         |
| ------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `Channel.CSV`                   | Yes (77 cols)                                                             | VFO rows optional — CPS-managed                               |
| `DMRZone.CSV`                   | Yes                                                                       |                                                               |
| `ScanList.CSV`                  | Yes                                                                       |                                                               |
| `DMRTalkGroups.CSV`             | Yes                                                                       |                                                               |
| `DMRReceiveGroupCallList.CSV`   | Yes                                                                       |                                                               |
| `RadioIDList.CSV`               | **Omit** ([#302](https://github.com/pskillen/codeplug-studio/issues/302)) | Placeholder profile rows clobber CPS; deferred until modelled |
| `AMAir.CSV`                     | Yes                                                                       |                                                               |
| `FM.CSV`                        | Yes                                                                       |                                                               |
| **`DMRDigitalContactList.CSV`** | **Yes** (10 cols)                                                         | Fixed in #297; fixture has redacted body row                  |

### CPS files not in Studio MVP export

`OptionalSetting.CSV`, encryption/hotkey/roaming/NXDN sidecars, tone encode tables, … — inventory and skip notes in [tier-3 README](../../../reference/formats/anytone/README.md). `APRS.CSV` / `AMZone.CSV` shipped when applicable.

---

## Closed — `Channel.CSV` VFO rows (was P0)

Official CPS appends slots `4001` / `4002` (VFO A/B). **Studio need not emit them** — CPS adds VFO rows on import ([#357](https://github.com/pskillen/codeplug-studio/issues/357)). See [channels.md](../../../reference/formats/anytone/channels.md) and [file-format.md](../../../reference/formats/anytone/file-format.md).

---

## Closed — `DMRDigitalContactList.CSV` (was P0)

10-column schema aligned in [#297](https://github.com/pskillen/codeplug-studio/issues/297). Address columns are digital-contact library fields; `Call Alert` remains export default `None` (`Online alert` observed, not modelled).

---

## P1 — Airband mode partition

**Shipped** ([#316](https://github.com/pskillen/codeplug-studio/issues/316)). Wire: [am-air.md](../../../reference/formats/anytone/am-air.md). **`FMZone.CSV` does not exist on D890.**

---

## P1 — `DMR MODE` and duplex

| Column                 | Studio today                         | Confirmed ([#357](https://github.com/pskillen/codeplug-studio/issues/357)) |
| ---------------------- | ------------------------------------ | -------------------------------------------------------------------------- |
| `DMR MODE`             | `0`/`1` from `dmrMode` / RX–TX infer | `0`=simplex, `1`=repeater; `2`/`3`=DCDM variants — **not exported**        |
| `Digital Duplex`       | `Off`                                | Still unknown in CPS UI — leave Needs elicitation                          |
| `Talk Around(Simplex)` | `Off`                                | Not modelled (skip)                                                        |

---

## Open — Channel contact / RGL export

Earlier comment suggested exporting TX contact from RGL membership. Operator elicitation did **not** confirm the requirement — tracked in [#531](https://github.com/pskillen/codeplug-studio/issues/531); see [csv-reconciliation-outstanding.md](csv-reconciliation-outstanding.md).

---

## P2 — Power / scan / defaults

| Topic                            | Docs                                                                            | Code                                                                                                                                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Power Mid / Turbo + watts        | [at-d890uv.md](../../../reference/formats/anytone/radios/at-d890uv.md)          | **Shipped** ([#391](https://github.com/pskillen/codeplug-studio/issues/391))                                                                                                                |
| Scan Mode / Revert / timing      | [scan-lists.md](../../../reference/formats/anytone/scan-lists.md)               | Timing → all `5.0` ([#402](https://github.com/pskillen/codeplug-studio/issues/402)); Scan Mode readiness [#393](https://github.com/pskillen/codeplug-studio/issues/393)                     |
| Busy Lock provisional constants  | [enum-verification.md](../../../reference/formats/anytone/enum-verification.md) | Mode-aware export constants shipped; full library field via [#388](https://github.com/pskillen/codeplug-studio/issues/388) / [#396](https://github.com/pskillen/codeplug-studio/issues/396) |
| Slot Suit / talker alias / …     | [enum-verification.md](../../../reference/formats/anytone/enum-verification.md) | [#395](https://github.com/pskillen/codeplug-studio/issues/395), [#398](https://github.com/pskillen/codeplug-studio/issues/398)                                                              |
| FM bank members in `DMRZone.CSV` | [fm-broadcast.md](../../../reference/formats/anytone/fm-broadcast.md) / zones   | [#418](https://github.com/pskillen/codeplug-studio/issues/418)                                                                                                                              |

---

## Code ↔ docs mop-up ([#402](https://github.com/pskillen/codeplug-studio/issues/402))

Single-pass reconciliation of Studio-emitted files against hand-reviewed tier-3 docs (2026-07). **Result:** headers/enums for shipped DMR/AM/FM/APRS files match; inventory README and a few cross-cutting notes were corrected. Remaining adapter defaults (`Dwell`, talker-alias prefer `1`) stay on existing child tickets — not re-filed.

---

## P2 — Fidelity tiers (reconciliation)

| Tier                       | Files / columns                                                                                                                   |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Bidirectional (target)** | DMR core columns documented in [channels.md](../../../reference/formats/anytone/channels.md), talk groups, RGL, zones, scan lists |
| **Export default**         | Unmodelled `Channel.CSV` tail (`channelDefaults.ts`); confirmation / talker-alias defaults                                        |
| **Header-only / Skip**     | OptionalSetting, HotKey, encryption, roaming (future epics)                                                                       |
| **Skip**                   | Import not in scope [#229](https://github.com/pskillen/codeplug-studio/issues/229)                                                |

---

## Non-issues (confirmed)

| Check                           | Result                                   |
| ------------------------------- | ---------------------------------------- |
| `Channel.CSV` column count      | 77 on every row                          |
| Quoting                         | All fields double-quoted                 |
| UTF-8 BOM                       | None                                     |
| Core DMR file headers           | Match fixtures                           |
| Line endings in operator export | CRLF (Studio export also CRLF post-#291) |
| Emitting Channel VFO rows       | Not required                             |
| `FMZone.CSV`                    | Does not exist on D890                   |

---

## References

- Studio export code: `src/core/import-export/formats/anytone/`
- Golden fixtures: `test-data/anytone/at-d890uv/`
- Enum checklist: [enum-verification.md](../../../reference/formats/anytone/enum-verification.md)
