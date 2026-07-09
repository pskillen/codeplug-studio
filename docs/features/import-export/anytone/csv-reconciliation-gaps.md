# Anytone CSV reconciliation — gaps

Variance report: **Codeplug Studio** Anytone export adapter vs **operator AT-D890UV CPS export-all** (`D890 codeplug export`, 2026-07).

Earlier single-build comparison: [tmp/export-variance-report.md](../../../../tmp/export-variance-report.md) (Studio export vs minimal official sample).

**Purpose:** Track wire-format mismatches for [#297](https://github.com/pskillen/codeplug-studio/issues/297). Tier-3 column detail stays in [docs/reference/anytone/](../../../reference/anytone/README.md).

---

## Executive summary

| Priority | Gap | Studio today | CPS / fixture |
| ---: | --- | --- | --- |
| **P0** | `DMRDigitalContactList.CSV` headers | 4 columns | 10 columns |
| **P0** | `Channel.CSV` VFO rows | Not emitted | Slots `4001`, `4002` required |
| **P1** | `AMZone.CSV` + airband partition | Not emitted | Separate AM zones; must not mix into `DMRZone.CSV` |
| **P1** | `DMR MODE` / duplex semantics | Always `0` | Observed `0`/`1`; semantics unclear vs split RX/TX |
| **P1** | Channel TX contact source | Talk group / contact ref only | Comment: pick from RGL on export |
| **P2** | 29 CPS sidecar files | Not in MVP export set | Manifest lists 38 files — see inventory below |
| **P2** | Enum value coverage | Partial defaults in `channelDefaults.ts` | Rich export does not exercise all enum paths |

Cross-file name FK issues from the earlier variance report were addressed in [#292](https://github.com/pskillen/codeplug-studio/issues/292).

---

## File inventory

| Metric | Studio MVP | Operator rich export |
| ---: | ---: | ---: |
| CSV files emitted | 7 DMR + `AMAir.CSV` / `FM.CSV` when non-empty | 38 |
| Manifest | `{project}.LST` in ZIP ([#289](https://github.com/pskillen/codeplug-studio/issues/289)) | `mm9pdy.LST` (38 entries) |
| `Channel.CSV` rows | Programmed channels only | 100 programmed + 2 VFO (`4001`–`4002`) |
| `DMRDigitalContactList.CSV` | Header wrong (4 cols) | Header correct (10 cols); 0 body rows |
| `ScanList.CSV` | Emitted when build has scan lists | 0 body rows in operator export |

### Studio MVP files — header comparison

| File | Header match | Notes |
| --- | --- | --- |
| `Channel.CSV` | Yes (77 cols) | Missing VFO rows; see structural gaps |
| `DMRZone.CSV` | Yes | |
| `ScanList.CSV` | Yes | |
| `DMRTalkGroups.CSV` | Yes | |
| `DMRReceiveGroupCallList.CSV` | Yes | |
| `RadioIDList.CSV` | Yes | |
| `AMAir.CSV` | Yes | |
| `FM.CSV` | Yes | |
| **`DMRDigitalContactList.CSV`** | **No** | Studio: `No., Callsign, Name, Call Type` — CPS: 10 columns |

### CPS files not in Studio MVP export

`OptionalSetting.CSV`, `APRS.CSV`, `AMZone.CSV`, encryption/hotkey/roaming/NXDN sidecars, tone encode tables, repeater whitelists, `PrefabricatedSMS.CSV`, `AnalogAddressBook.CSV`, `AutoRepeaterOffsetFrequencys.CSV`, `GPSRoaming.CSV`, `AlertTone.CSV`, `MDC1200*`, `NXStateMSG.CSV`, … — full list in [tier-3 README — file inventory](../../../reference/anytone/README.md).

---

## P0 — `DMRDigitalContactList.CSV`

| | Studio (bug) | CPS / `test-data/anytone/at-d890uv/` |
| --- | --- | --- |
| Column count | 4 | 10 |
| Header | `"No.","Callsign","Name","Call Type"` | `"No.","Radio ID","Callsign","Name","City","State","Country","Remarks","Call Type","Call Alert"` |

**Code:** `DIGITAL_CONTACT_COL` in `columns.ts`; `serialiseDigitalContactsCsv()` in `serialise.ts`.

**Docs:** [talk-groups.md](../../../reference/anytone/talk-groups.md) already documents 10 columns — implementation drift.

**Impact:** CPS may reject or skip file on import even when body is empty.

**Fix (slice 2):** Align headers; map `digitalId` → `Radio ID`, wire name → `Name`; export defaults for `City`/`State`/`Country`/`Remarks`/`Call Alert` until library models address book fields.

---

## P0 — `Channel.CSV` VFO rows

Official CPS and rich operator export append fixed high-slot VFO placeholders:

| `No.` | `Channel Name` (sample) |
| ---: | --- |
| `4001` | Channel VFO A |
| `4002` | Channel VFO B |

Studio `serialiseChannelsCsv()` emits programmed slots only. `AMAir.CSV` / `FM.CSV` already append bank VFO rows (`257`, `101`).

**Impact:** Likely channel import failure or missing VFO semantics.

---

## P1 — Airband mode partition

When the radio operates in airband mode, CPS uses a **separate entity set**:

- `AMAir.CSV` — airband channel bank (Studio exports when partition non-empty)
- `AMZone.CSV` — airband zones (**not exported**)
- `DMRZone.CSV` — must **not** include airband-only members

**Rule (from #297 comment):** If a DMR zone contains any airband channel, emit a dedicated airband zone in `AMZone.CSV` instead of mixing into `DMRZone.CSV`. Omit DMR zones that would contain only airband channels.

---

## P1 — `DMR MODE` and duplex

| Column | Studio default | Rich export observed |
| --- | --- | --- |
| `DMR MODE` | `0` (`channelDefaults.ts`) | `0` (most DMR rows) and `1` (3 rows: hotspot + both VFO rows) |
| `Digital Duplex` | `Off` | `Off` throughout sample |
| `Talk Around(Simplex)` | `Off` | `Off` throughout sample |

**Operator intent (#297 comment):** map split RX/TX → repeater mode, equal RX/TX → DMO/simplex.

**Sample contradiction:** 20 digital repeater channels (split frequencies) still have `DMR MODE` = `0`. Do **not** implement mapping from comment alone — elicit full enum in CPS ([enum-verification.md](../../../reference/anytone/enum-verification.md)).

---

## P1 — Channel contact / RGL export

Rich export uses named talk groups in `Contact/Talk Group` with matching `Receive Group List` names. Studio maps `contactRef` from the DMR mode profile.

**Gap (#297 comment):** export TX contact from RGL membership when configured, rather than defaulting to Local 9 / first TG.

**Related columns:** `Send Talker Alias DMR/NX`, `APRS RX` — mostly `0`/`Off` in sample; APRS tracked separately.

---

## P2 — Fidelity tiers (reconciliation)

| Tier | Files / columns |
| --- | --- |
| **Bidirectional (target)** | DMR core columns documented in [channels.md](../../../reference/anytone/channels.md), talk groups, RGL, zones, scan lists |
| **Export default** | Unmodelled `Channel.CSV` tail (`channelDefaults.ts`); digital contact address columns |
| **Header-only** | CPS tables Studio skips until modelled (`OptionalSetting.CSV`, encryption, …) |
| **Skip** | Import not in scope [#229](https://github.com/pskillen/codeplug-studio/issues/229) |

---

## Non-issues (confirmed in rich export)

| Check | Result |
| --- | --- |
| `Channel.CSV` column count | 77 on every row |
| Quoting | All fields double-quoted |
| UTF-8 BOM | None |
| Core DMR file headers (except digital contacts) | Match fixtures |
| Line endings in operator export | CRLF (Studio export also CRLF post-#291) |

---

## References

- Studio export code: `src/core/import-export/formats/anytone/`
- Golden fixtures: `test-data/anytone/at-d890uv/`
- Enum checklist: [enum-verification.md](../../../reference/anytone/enum-verification.md)
- Follow-up tickets: [tmp/anytone-csv-reconciliation-follow-up-tickets.md](../../../../tmp/anytone-csv-reconciliation-follow-up-tickets.md)
