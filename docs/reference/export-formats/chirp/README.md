# CHIRP CSV reference

> **Studio status:** Wire reference ported from [codeplug-tool](https://github.com/pskillen/codeplug-tool); CHIRP import/export adapters ship Phase 4–6 under `src/core/import-export/formats/chirp/`.

Authoritative reference for **CHIRP** radio memory CSV exports — one wire format among several at the import/export boundary (siblings: OpenGD77, DM32, qDMR, native YAML). CHIRP is **analogue FM/AM** oriented; DMR columns exist in the wire format but are empty on analogue exports.

**Tracking:** archive reference (codeplug-tool#103)

## File shape

| Property         | Value                                                                  |
| ---------------- | ---------------------------------------------------------------------- |
| Files per export | **One** `.csv` per radio                                               |
| Typical filename | `{RadioModel}_{YYYYMMDD}.csv` (e.g. `Baofeng_UV-5R Mini_20251129.csv`) |
| Delimiter        | Comma                                                                  |
| Frequency format | MHz, six decimal places (e.g. `145.500000`)                            |
| Foreign keys     | None — flat channel list                                               |

Sample fixtures: [`sample-exports/Chirp 2026-06-29/`](../../../../sample-exports/Chirp%202026-06-29/) (archive reference #101).

## Two-layer model

| Layer                   | Location                                    | Contents                                                  |
| ----------------------- | ------------------------------------------- | --------------------------------------------------------- |
| **Generic wire format** | This directory ([channels.md](channels.md)) | Column headers, semantic mapping, conversion rules        |
| **Radio profiles**      | [`profiles.md`](profiles.md) · [`radios/`](../../radios/) | Studio `profileId` → radio home; caps/power in radios tree |

The **internal library model is format-agnostic** ([data model](../../../features/data-model/README.md)). CHIRP profile limits apply at **export time** when the operator picks a target radio.

## File set

| File          | Reference                  | Import (app) | Export (app) | Modelled         |
| ------------- | -------------------------- | ------------ | ------------ | ---------------- |
| `{radio}.csv` | [channels.md](channels.md) | Yes          | Yes          | `Channel[]` only |

No zones, contacts, talk groups, or RX group lists in CHIRP analogue exports.

## Classification (import)

`detectKind(fileName, headerRow)` in [`src/core/import-export/formats/chirp/adapter.ts`](../../../../src/core/import-export/formats/chirp/adapter.ts):

| Signal                                                            | Result     |
| ----------------------------------------------------------------- | ---------- |
| Headers include `Location`, `Name`, `Frequency`, `Duplex`, `Mode` | `channels` |
| Otherwise                                                         | `unknown`  |

## Skip vs error

| Outcome              | When                                                          |
| -------------------- | ------------------------------------------------------------- |
| **Recognised**       | CHIRP header fingerprint matches                              |
| **Error**            | Recognised file fails parse (empty CSV, unparseable row)      |
| **Rejected (batch)** | Mixed CHIRP + OpenGD77 files when a single format is selected |

## Wire verification

Structural rules enforced by `cps-verify` for all CHIRP profiles ([wire-verification.md](../../../build/testing/wire-verification.md)). Caps come from [`profiles.ts`](../../../../src/core/import-export/formats/chirp/profiles.ts) — see [enum-verification.md](enum-verification.md) and [profiles.md](profiles.md).

| Rule         | Expectation                                                                |
| ------------ | -------------------------------------------------------------------------- |
| Line endings | **LF** (Studio export via OpenGD77-style `csvWrite`)                       |
| Quoting      | Selective RFC 4180                                                         |
| Headers      | Exact `CHIRP_HEADERS` set + order (= CHIRP `Memory.CSV_FORMAT`)            |
| Foreign keys | None (flat memory list)                                                    |
| Cardinality  | Row count ≤ profile `maxMemorySlots`; channel `Name` ≤ profile `nameLimit` |
| Files        | Single `.csv` (any basename)                                               |

| Profile      | Memory slots | Name length |
| ------------ | ------------ | ----------- |
| `chirp-uv5r` | 999          | 12          |
| `chirp-uv21` | 1000         | 12          |
| `chirp-rt95` | 200          | 6           |

## DMR columns on analogue exports

`URCALL`, `RPT1CALL`, `RPT2CALL`, `DVCODE` are part of the CHIRP wire schema for digital-capable radios. On analogue FM exports in our fixtures they are **empty**. Import ignores them; export leaves them blank.

## Related

- [enum-verification.md](enum-verification.md) — CHIRP source vs Studio checklist
- [Data model](../../../features/data-model/README.md)
- [Channel modes](../../channel-modes.md)
- [OpenGD77 reference](../opengd77/README.md) — sibling format
