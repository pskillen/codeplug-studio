# CHIRP — channel CSV

Wire column reference for the single CHIRP memory CSV. Per-radio memory and power limits: [radios/](radios/README.md).

**Code:** [`columns.ts`](../../../src/core/import-export/formats/chirp/columns.ts) · [`channelWire.ts`](../../../src/core/import-export/formats/chirp/channelWire.ts) · [`profiles.ts`](../../../src/core/import-export/formats/chirp/profiles.ts)

**CHIRP source:** header order matches `Memory.CSV_FORMAT` in `chirp_common.py` — see [enum-verification.md](enum-verification.md).

Import and export require a **radio profile** (`profileId`) for the power ladder.

## Required headers (app import)

| Header | Reason           |
| ------ | ---------------- |
| `Name` | Channel identity |

Full standard header row (21 columns): `Location`, `Name`, `Frequency`, `Duplex`, `Offset`, `Tone`, `rToneFreq`, `cToneFreq`, `DtcsCode`, `DtcsPolarity`, `RxDtcsCode`, `CrossMode`, `Mode`, `TStep`, `Skip`, `Power`, `Comment`, `URCALL`, `RPT1CALL`, `RPT2CALL`, `DVCODE`.

Parse by **header name**, not column index.

## Column reference

| CHIRP header                                       | Internal field             | Import                             | Export                                                                        | Notes                                                        |
| -------------------------------------------------- | -------------------------- | ---------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `Location`                                         | —                          | ignored                            | 1-based export index                                                          | Excluded from bidirectional mapping compare                  |
| `Name`                                             | composed wire name         | trim; skip empty                   | `composeChannelWireName(callsign, name, export name mode setting)`            | Case-sensitive                                               |
| `Frequency`                                        | `rxFrequency`              | MHz → Hz                           | Hz → MHz (6 dp)                                                               |                                                              |
| `Duplex`+`Offset`                                  | `forbidTransmit` cascade   | see duplex table                   | `effectiveForbidTransmit` + context → `deriveChirpDuplexAndOffset`            | `off` = TX disabled via cascade                              |
| `Tone`                                             | derived                    | see tone table                     | from `rxTone`/`txTone`                                                        |                                                              |
| `rToneFreq`                                        | `txTone` (`Tone` mode)     | see tone table                     | see tone table                                                                | Default `88.5` when unused                                   |
| `cToneFreq`                                        | `rxTone`/`txTone` (`TSQL`) | see tone table                     | see tone table                                                                | Default `88.5` when unused                                   |
| `DtcsCode`/`DtcsPolarity`/`RxDtcsCode`/`CrossMode` | `rxTone`/`txTone` (DCS)    | ignored (import out of scope)      | from `formatChirpToneColumns` — see [Tones](#tones)                           | Studio `D023N`/`D047P`; CHIRP polarity `N`/`R` (`P`→`R`)     |
| `Mode`                                             | `mode`, `bandwidthKHz`     | `NFM`→fm+12.5; `FM`→fm+25; `AM`→am | inverse                                                                       | Not derived from `TStep`                                     |
| `TStep`                                            | —                          | ignored                            | constant `5.00`                                                               |                                                              |
| `Skip`                                             | `scanInclusion`            | `S`→`skip`; blank→`default`        | Resolved `skip`→`S`; else empty                                               | `P` unsupported; build default applies to `default` channels |
| `Power`                                            | `power`                    | profile ladder wire→percent        | profile ladder percent→wire                                                   | Requires `profileId`                                         |
| `Comment`                                          | `comment` on import only   | trim                               | **Not exported** — internal `comment` field only; column left empty on export |
| `URCALL`/`RPT1CALL`/`RPT2CALL`/`DVCODE`            | —                          | ignored                            | empty                                                                         | Digital — not modelled                                       |

`txFrequency` is derived on import from `Frequency` + `Duplex` + `Offset`.

## Export name length and shortening

CHIRP `Name` is the composed wire name (`composeChannelWireName`). Profile `nameLimit` varies by radio (UV-5R Mini / UV-21Pro V2: **12**; RT95 VOX: **6** — CHIRP driver caps). Shortening runs per export file with a shared reserved-name set.

## Duplex

| `Duplex` | Meaning        | Model                           |
| -------- | -------------- | ------------------------------- |
| empty    | Simplex        | TX = RX, `forbidTransmit=false` |
| `+`      | Positive split | TX = RX + offset                |
| `-`      | Negative split | TX = RX − offset                |
| `off`    | TX disabled    | TX = RX, `forbidTransmit=true`  |

Export uses `deriveChirpDuplexAndOffset(rxFrequency, txFrequency, effectiveForbidTransmit)` with `channelBehaviourContext` — the inverse of import. **Lossy:** zero-offset `+`/`-` (offset 0, TX = RX) collapse to simplex in the model and export with an empty `Duplex` column; CHIRP files that used `+`/`-` with offset `0` will not bidirectional mapping that wire literally.

## Behavioural defaults cascade

| Cascade field       | CHIRP wire       | Export                                          |
| ------------------- | ---------------- | ----------------------------------------------- |
| `forbidTransmit`    | `Duplex` = `off` | Shipped via cascade                             |
| `txPermit`          | _(none)_         | Loss — no Busy Lock / TX Admit column           |
| `sendTalkerAlias`   | _(none)_         | Loss — no DMR talker-alias column               |
| `analogSquelchMode` | _(none)_         | Loss — tone mode is from `rxTone`/`txTone` only |

See [channel-behavioural-defaults.md](../channel-behavioural-defaults.md).

## Tones

Export mirrors CHIRP `split_tone_decode`: classify each of `txTone` / `rxTone` as none, CTCSS (`Tone`), or DCS (`DTCS` from `D###[NP]`), then collapse to a CHIRP `Tone` mode.

### CTCSS / empty

| `Tone` | `rToneFreq` | `cToneFreq` | Model                         |
| ------ | ----------- | ----------- | ----------------------------- |
| empty  | `88.5`      | `88.5`      | both `none`                   |
| `Tone` | TX CTCSS    | `88.5`      | `txTone` CTCSS, `rxTone=none` |
| `TSQL` | `88.5`      | CTCSS       | `rxTone=txTone` (same CTCSS)  |

### DTCS / Cross

| `Tone`  | `CrossMode`   | DTCS columns                        | Model                                        |
| ------- | ------------- | ----------------------------------- | -------------------------------------------- |
| `DTCS`  | `Tone->Tone`† | `DtcsCode` = code; polarity TX+RX   | same DCS both sides (`D023N` ↔ `023` / `NN`) |
| `Cross` | `DTCS->`      | `DtcsCode` from TX                  | TX DCS only                                  |
| `Cross` | `->DTCS`      | `RxDtcsCode` from RX                | RX DCS only                                  |
| `Cross` | `Tone->DTCS`  | RX code in `RxDtcsCode`; TX in freq | CTCSS TX + DCS RX                            |
| `Cross` | `DTCS->Tone`  | TX code in `DtcsCode`; RX in freq   | DCS TX + CTCSS RX                            |
| `Cross` | `Tone->Tone`  | defaults                            | unequal CTCSS both sides                     |
| `Cross` | `->Tone`      | defaults; `cToneFreq` = RX CTCSS    | RX CTCSS only                                |
| `Cross` | `DTCS->DTCS`  | both codes + polarity               | unequal DCS codes and/or polarities          |

† Unused `CrossMode` / DTCS cells keep CHIRP Memory defaults (`023` / `NN` / `Tone->Tone`) when `Tone` is not `Cross`.

**Polarity:** Studio/OpenGD77/NeonPlug use `N`/`P` on `D###[NP]`. CHIRP `DtcsPolarity` is two characters TX then RX (`NN`|`NR`|`RN`|`RR`); map Studio `P` → CHIRP `R`.

Unused CTCSS cells are `88.5`. DCS is never written into `rToneFreq` / `cToneFreq`.

**Accepted export loss:** CHIRP `DTCS-R` and `TSQL-R` tmodes are not emitted (no reverse-only model field).

## Mode

| CHIRP `Mode` | `mode` | `bandwidthKHz` |
| ------------ | ------ | -------------- |
| `NFM`        | `fm`   | 12.5           |
| `FM`         | `fm`   | 25             |
| `AM`         | `am`   | null           |

## Power

See per-radio ladders in [radios/](radios/README.md). Internal `power` is 0–100 percent; `null` = radio default (exports as profile high step).

## TX Admit

CHIRP channel CSV has **no TX Admit column**. The internal `Channel.txAdmit` enum is retained for cross-format projects but is **not serialised** on CHIRP export.

## Bidirectional mapping

Model-only serialisation — no `wireColumns` provenance stash. File-level tests: `test-data/chirp/` with matching `profileId`.

## Related

- [CHIRP overview](README.md)
- [Radio profiles](radios/README.md)
