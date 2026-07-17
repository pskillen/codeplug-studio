# DM32 — Channels.csv

Baofeng DM-32UV stock CPS `Channels.csv` (40 columns, v1.60). Cardinality and ladders: [radios/baofeng-dm32uv.md](radios/baofeng-dm32uv.md).

**Code (export):** [`columns.ts`](../../../src/core/import-export/formats/dm32/columns.ts) · [`channelWire.ts`](../../../src/core/import-export/formats/dm32/channelWire.ts) · [`serialise.ts`](../../../src/core/import-export/formats/dm32/serialise.ts)

> **Import:** CPS → library parsing is not shipped yet ([#112](https://github.com/pskillen/codeplug-studio/issues/112)). Import columns below describe intended/archive behaviour; do not assume a `parse.ts` module exists under `formats/dm32/`.

## Required headers (app import)

| Header         | Reason                                    |
| -------------- | ----------------------------------------- |
| `Channel Name` | Identity; rows without a name are skipped |
| `Channel Type` | Mode / dual-mode mapping                  |

## Channel Type

| Wire            | Internal                                              |
| --------------- | ----------------------------------------------------- |
| `Analog`        | `mode: fm`, `multiMode: false`                        |
| `Digital`       | `mode: dmr`, `multiMode: false`                       |
| `Fixed Analog`  | `multiMode: true`, primary TX analog (`fm` profile)   |
| `Fixed Digital` | `multiMode: true`, primary TX digital (`dmr` profile) |

Some CPS builds spell analogue `Anlaog` — accept on import; export uses fixture spelling from model.

## Column reference

| Vendor header                                          | Internal field                        | Import                         | Export                                                  | Bidirectional mapping  | Notes                                                                                                                     |
| ------------------------------------------------------ | ------------------------------------- | ------------------------------ | ------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `No.`                                                  | _(export only)_                       | Ignored                        | Sequential `1…n`                                        | **Excluded**           |                                                                                                                           |
| `Channel Name`                                         | `Channel.name`                        | Trim                           | As stored / shortened                                   | Yes                    | Case-sensitive FK                                                                                                         |
| `Channel Type`                                         | `mode` / `multiMode` / `modeProfiles` | See above                      | From profiles                                           | Yes                    |                                                                                                                           |
| `RX Frequency[MHz]`                                    | `rxFrequency`                         | MHz → Hz                       | Hz → MHz (5 dp)                                         | Yes                    |                                                                                                                           |
| `TX Frequency[MHz]`                                    | `txFrequency`                         | MHz → Hz; empty → `null`       | Hz → MHz or empty                                       | Yes                    | RX-only airband                                                                                                           |
| `Power`                                                | `power`                               | Wire → % via ladder            | % → `High`/`Middle`/`Low`                               | Yes                    |                                                                                                                           |
| `Band Width`                                           | `bandwidthKHz`                        | `12.5KHz` → 12.5; `25KHz` → 25 | Reverse                                                 | Yes                    |                                                                                                                           |
| `Scan List`                                            | —                                     | **Ignored**                    | Zone-derived list name, or `None`                       | **Lossy**              | FK on scan **carrier** only when zone-derived scan export is on — [scan-lists.md](scan-lists.md)                          |
| `TX Admit`                                             | `txPermit` cascade                    | Wire → enum                    | Resolved `txPermit` → wire                              | Partial                | `busyLock` → `Channel Idle`; `permitAlways` → `Allow TX` ([#445](https://github.com/pskillen/codeplug-studio/issues/445)) |
| `Emergency System`                                     | —                                     | Ignored                        | **Constant** `None`                                     | Constant default       |                                                                                                                           |
| `Squelch Level`                                        | `squelch`                             | 0–9 → % via ladder             | % → 0–9; `null` → `1` on analog rows only, else `0`     | Yes                    |                                                                                                                           |
| `APRS Report Type`                                     | —                                     | Trim                           | **Constant** `Off`                                      | Constant               | Library `Channel.aprs` not projected yet ([#250](https://github.com/pskillen/codeplug-studio/issues/250))                 |
| `Forbid TX`                                            | `forbidTransmit`                      | 0/1                            | 0/1 from behavioural cascade                            | Yes                    | Receive-only when `1`                                                                                                     |
| `APRS Receive`                                         | —                                     | 0/1                            | **Constant** `0`                                        | Constant               | [#250](https://github.com/pskillen/codeplug-studio/issues/250)                                                            |
| `Forbid Talkaround`                                    | —                                     | 0/1                            | **Constant** `0`                                        | Constant               | Unmodelled                                                                                                                |
| `Auto Scan`                                            | —                                     | Ignored                        | `1` on scan carrier when zone-derived scan on; else `0` | Constant / scan export |                                                                                                                           |
| `Lone Work` … `Digital APRS PTT Mode`                  | —                                     | Ignored                        | **Constant** `0`                                        | Constant               |                                                                                                                           |
| `TX Contact`                                           | `contactRef`                          | Name → ref                     | Ref → name or `None`                                    | Yes                    | FK → Talkgroups / Contacts                                                                                                |
| `RX Group List`                                        | `rxGroupListId`                       | Name or `ALL` → ref            | Ref → name; `ALL` sentinel                              | Yes                    | See [multi-talkgroup.md](multi-talkgroup.md)                                                                              |
| `Color Code`                                           | `colourCode`                          | Parse int                      | As string                                               | Yes                    | `0` analogue                                                                                                              |
| `Time Slot`                                            | `timeslot`                            | `Slot 1`/`Slot 2` → 1/2        | Reverse                                                 | Yes                    |                                                                                                                           |
| `Encryption` / `Encryption ID`                         | —                                     | Ignored                        | **Constant** `0` / `None`                               | Constant               |                                                                                                                           |
| `APRS Report Channel`                                  | —                                     | Parse int                      | **Heuristic** `256` analog/native-dual; `1` digital     | Constant heuristic     | Not from a library field; APRS projection [#250](https://github.com/pskillen/codeplug-studio/issues/250)                  |
| `Direct Dual Mode`                                     | —                                     | 0/1                            | **Constant** `0`                                        | Constant               | Unmodelled                                                                                                                |
| `Private Confirm` / `Short Data Confirm`               | —                                     | Ignored                        | **Constant** `0`                                        | Constant               |                                                                                                                           |
| `DMR ID`                                               | —                                     | **Ignored**                    | Profile `defaultDmrIdLabel`                             | **Lossy**              | Accepted gap ([#446](https://github.com/pskillen/codeplug-studio/issues/446))                                             |
| `CTC/DCS Decode` / `Encode`                            | `rxTone` / `txTone`                   | Wire → tone                    | Tone → wire                                             | Yes                    | `None` when off                                                                                                           |
| `Scramble`                                             | —                                     | Ignored                        | **Constant** `None`                                     | Constant               |                                                                                                                           |
| `RX Squelch Mode`                                      | `analogSquelchMode` cascade           | Wire → enum                    | Resolved cascade → wire                                 | Partial                | See mapping below                                                                                                         |
| `Signaling Type` / `PTT ID` / `VOX` / `PTT ID Display` | —                                     | Ignored                        | **Constant** `None` / `OFF` / `0` / `0`                 | Constant               |                                                                                                                           |

### TX Admit mapping

Maps resolved `txPermit` from the [behavioural defaults cascade](../channel-behavioural-defaults.md) (library → channel → build):

| Resolved `txPermit` | DM-32 `TX Admit` wire |
| ------------------- | --------------------- |
| `busyLock`          | `Channel Idle`        |
| `permitAlways`      | `Allow TX`            |

Legacy import wires map unknown values to `channel_idle` (`Channel Idle`) until import-side cascade lands. Full CPS enum coverage: [#445](https://github.com/pskillen/codeplug-studio/issues/445).

### RX Squelch Mode mapping

Maps resolved `analogSquelchMode` on the analog profile (or library default for digital-only rows):

| Resolved `analogSquelchMode` | `RX Squelch Mode` wire |
| ---------------------------- | ---------------------- |
| `carrier`                    | `Carrier`              |
| `tone`                       | `Carrier/CTC`          |

### Export loss

| Internal field    | DM-32 wire | Notes                                                                                  |
| ----------------- | ---------- | -------------------------------------------------------------------------------------- |
| `sendTalkerAlias` | _(none)_   | No talker-alias column on wire                                                         |
| `Channel.aprs`    | APRS cols  | Hardcoded Off/`0` until [#250](https://github.com/pskillen/codeplug-studio/issues/250) |

`Channel Name` maps to split internal fields on import and is **composed on export**. Split rules: [channel-name-parsing](../../features/channel-name-parsing.md).

## Export name length and shortening

Default profile `nameLimit` is **16** (`src/core/import-export/formats/dm32/profiles.ts`). Expanded multi-talkgroup row names share the same shortening pipeline as OpenGD77; zone member wire names match shortened channel names. See name shortening (Phase 4+).

## Export expansion (DM32 adapter)

| Flag                 | Value              | Reason                                                                                    |
| -------------------- | ------------------ | ----------------------------------------------------------------------------------------- |
| `expandModes`        | `false`            | Native `Fixed Analog` / `Fixed Digital` on one row                                        |
| `expandRxGroupLists` | `true` with guards | Expand only merged logical channels; skip when TX contact + RGL both set; skip `ALL` list |

See [multi-mode.md](multi-mode.md) and [multi-talkgroup.md](multi-talkgroup.md).
