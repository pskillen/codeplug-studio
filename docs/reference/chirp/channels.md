# CHIRP — channel CSV

Wire column reference for the single CHIRP memory CSV. Per-radio memory and power limits: [radios/](radios/README.md).

**Code:** [`columns.ts`](../../../src/core/import-export/formats/chirp/columns.ts) · [`parse.ts`](../../../src/core/import-export/formats/chirp/parse.ts) · [`channelWire.ts`](../../../src/core/import-export/formats/chirp/channelWire.ts) (import) · [`channelWire.ts`](../../../src/core/import-export/formats/chirp/channelWire.ts) (export) · [`profiles.ts`](../../../src/core/import-export/formats/chirp/profiles.ts)

Import and export require a **radio profile** (`profileId`) for the power ladder.

## Required headers (app import)

| Header | Reason |
| --- | --- |
| `Name` | Channel identity |

Full standard header row (21 columns): `Location`, `Name`, `Frequency`, `Duplex`, `Offset`, `Tone`, `rToneFreq`, `cToneFreq`, `DtcsCode`, `DtcsPolarity`, `RxDtcsCode`, `CrossMode`, `Mode`, `TStep`, `Skip`, `Power`, `Comment`, `URCALL`, `RPT1CALL`, `RPT2CALL`, `DVCODE`.

Parse by **header name**, not column index.

## Column reference

| CHIRP header | Internal field | Import | Export | Notes |
| --- | --- | --- | --- | --- |
| `Location` | — | ignored | 1-based export index | Excluded from bidirectional mapping compare |
| `Name` | composed wire name | trim; skip empty | `composeChannelWireName(callsign, name, exportNameMode)` | Case-sensitive |
| `Frequency` | `rxFrequency` | MHz → Hz | Hz → MHz (6 dp) | |
| `Duplex`+`Offset` | `txFrequency`, `forbidTransmit` | see duplex table | inverse | `off` = TX disabled (`forbidTransmit`) |
| `Tone` | derived | see tone table | from `rxTone`/`txTone` | |
| `rToneFreq` | `txTone` (`Tone` mode) | see tone table | see tone table | Default `88.5` when unused |
| `cToneFreq` | `rxTone`/`txTone` (`TSQL`) | see tone table | see tone table | Default `88.5` when unused |
| `DtcsCode`/`DtcsPolarity`/`RxDtcsCode`/`CrossMode` | — | ignored | constants `023`/`NN`/`023`/`Tone->Tone` | DCS not modelled yet |
| `Mode` | `mode`, `bandwidthKHz` | `NFM`→fm+12.5; `FM`→fm+25; `AM`→am | inverse | Not derived from `TStep` |
| `TStep` | — | ignored | constant `5.00` | |
| `Skip` | `scanSkip` | `S`→true | true→`S` | `P` unsupported |
| `Power` | `power` | profile ladder wire→percent | profile ladder percent→wire | Requires `profileId` |
| `Comment` | `comment` on import only | trim | **Not exported** — internal `comment` field only; column left empty on export |
| `URCALL`/`RPT1CALL`/`RPT2CALL`/`DVCODE` | — | ignored | empty | Digital — not modelled |

`txFrequency` is derived on import from `Frequency` + `Duplex` + `Offset`.

## Export name length and shortening

CHIRP `Name` is the composed wire name (`composeChannelWireName`). Profile `nameLimit` varies (e.g. **7** on UV-5R mini, **16** on UV-21 Pro V2). Shortening runs per export file with a shared reserved-name set. See name shortening (Phase 4+).

## Duplex

| `Duplex` | Meaning | Model |
| --- | --- | --- |
| empty | Simplex | TX = RX, `forbidTransmit=false` |
| `+` | Positive split | TX = RX + offset |
| `-` | Negative split | TX = RX − offset |
| `off` | TX disabled | TX = RX, `forbidTransmit=true` |

Export uses `deriveChirpDuplexAndOffset(rxFrequency, txFrequency, forbidTransmit)` — the inverse of import. **Lossy:** zero-offset `+`/`-` (offset 0, TX = RX) collapse to simplex in the model and export with an empty `Duplex` column; CHIRP files that used `+`/`-` with offset `0` will not bidirectional mapping that wire literally.

## Tones

| `Tone` | `rToneFreq` | `cToneFreq` | Model |
| --- | --- | --- | --- |
| empty | — | — | both `none` |
| `Tone` | TX CTCSS | `88.5` | `txTone` set, `rxTone=none` |
| `TSQL` | `88.5` | CTCSS | `rxTone=txTone` |

Export uses `88.5` for unused frequency cells.

## Mode

| CHIRP `Mode` | `mode` | `bandwidthKHz` |
| --- | --- | --- |
| `NFM` | `fm` | 12.5 |
| `FM` | `fm` | 25 |
| `AM` | `am` | null |

## Power

See per-radio ladders in [radios/](radios/README.md). Internal `power` is 0–100 percent; `null` = radio default (exports as profile high step).

## TX Admit

CHIRP channel CSV has **no TX Admit column**. The internal `Channel.txAdmit` enum is retained for cross-format projects but is **not serialised** on CHIRP export.

## Bidirectional mapping

Model-only serialisation — no `wireColumns` provenance stash. File-level tests: `test-data/chirp/` with matching `profileId`.

## Related

- [CHIRP overview](README.md)
- [Radio profiles](radios/README.md)
