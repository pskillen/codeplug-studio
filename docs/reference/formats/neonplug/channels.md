# NeonPlug channels

Wire shape for `codeplug.json` → `channels[]`.

**Ground truth:** [NeonPlug `Channel.ts`](https://github.com/infamy/NeonPlug/blob/main/src/models/Channel.ts)

NeonPlug uses **one Channel type** for all radios. DM-32UV fills digital fields; UV5R-Mini maps into the same object with analogue-relevant fields only ([`uv5rmini/channelMapping.ts`](https://github.com/infamy/NeonPlug/blob/main/src/radios/uv5rmini/channelMapping.ts)).

## Identity and ordering

| Field    | Type   | Notes                                                                                                |
| -------- | ------ | ---------------------------------------------------------------------------------------------------- |
| `number` | number | Channel number (DM32: typically 1–4000; UV5R: memory slot)                                           |
| `name`   | string | Display / radio name — **max 16** chars in DM32 comments; UV5R uses shorter effective names on write |

`number` is the **wire FK** used by zones and scan lists. It is **not** a Studio library id.

On DM32UV export with m×n expansion enabled (default), Studio may emit **more than one** `channels[]` object per library channel (one per RX-list talk group, plus an optional scratch companion). Numbers are assigned sequentially across the expanded set. See [export-projections.md](../../../features/import-export/neonplug/export-projections.md).

When zone-derived scan export is on, Studio also appends one synthetic **`{zoneName} Scan`** Analog/FM simplex row per exported scan list (export-only id `scan-carrier:{zoneId}`). That carrier is prepended as the first zone member and receives the list’s `scanListId`; see [scan-lists.md](scan-lists.md).

## Frequencies

| Field         | Type   | Unit | Notes                          |
| ------------- | ------ | ---- | ------------------------------ |
| `rxFrequency` | number | MHz  | e.g. `145.3500`                |
| `txFrequency` | number | MHz  | Same units; simplex → equal RX |

Studio internal model uses Hz; convert at the boundary.

### Receive-only / no-TX sentinel

NeonPlug’s aviation/FM receive-only contract (RX **87–136 MHz** with `forbidTx`) stores TX as `0xFF` on the radio and uses JSON sentinel **`1666.666`** (`NO_TX_FREQUENCY`). Write-time validation (`isValidChannelFrequency`) accepts that band **only** when `forbidTx` is true **and** TX is the sentinel — `txFrequency: 0` is treated as invalid and the channel is dropped before write.

| Condition                                      | Studio export                               |
| ---------------------------------------------- | ------------------------------------------- |
| Effective `forbidTx` and RX MHz in `[87, 136)` | `forbidTx: true`, `txFrequency: 1666.666`   |
| Otherwise                                      | `txFrequency` from model Hz (null/≤0 → `0`) |

Ground truth: NeonPlug `frequencyValidator.ts` / airport import (`airportChannels.ts`).

## Mode and TX allow

| Field        | Type / enum                                                  | Notes                  |
| ------------ | ------------------------------------------------------------ | ---------------------- |
| `mode`       | `'Analog' \| 'Digital' \| 'Fixed Analog' \| 'Fixed Digital'` | Channel Type           |
| `forbidTx`   | boolean                                                      | TX forbidden when true |
| `loneWorker` | boolean                                                      |                        |

## Bandwidth, scan, APRS (selected)

| Field              | Type / enum                      | Notes                                                             |
| ------------------ | -------------------------------- | ----------------------------------------------------------------- |
| `bandwidth`        | `'12.5kHz' \| '25kHz'`           | Wide / narrow                                                     |
| `scanAdd`          | boolean                          | Per-channel scan include                                          |
| `scanListId`       | number                           | Index into scan lists (bit-packed on radio)                       |
| `forbidTalkaround` | boolean                          |                                                                   |
| `aprsReceive`      | boolean                          | From `Channel.aprs.receiveEnabled`                                |
| `aprsReportMode`   | `'Off' \| 'Digital' \| 'Analog'` | Studio emits `'Digital'` or `'Off'` only — see [aprs.md](aprs.md) |
| `power`            | `'Low' \| 'Medium' \| 'High'`    | UV5R mapping uses Low/High only                                   |

## Analogue tones and squelch

| Field                                                 | Type                                                                          | Notes                 |
| ----------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------- |
| `rxCtcssDcs`                                          | `{ type: 'CTCSS' \| 'DCS' \| 'None'; value?: number; polarity?: 'N' \| 'P' }` | CTCSS Hz or DCS code  |
| `txCtcssDcs`                                          | same                                                                          |                       |
| `squelchLevel`                                        | number                                                                        | 0–255                 |
| `rxSquelchMode`                                       | `'Carrier/CTC' \| 'Optional' \| 'CTC&Opt' \| 'CTC\|Opt'`                      |                       |
| `voxFunction` / `scramble` / `compander` / `talkback` | boolean                                                                       | Analogue feature bits |

## Digital (DMR) fields

Valid when `mode` is `Digital` or `Fixed Digital`:

| Field                                 | Type     | Notes                                        |
| ------------------------------------- | -------- | -------------------------------------------- |
| `colorCode`                           | number   | 0–15                                         |
| `contactId`                           | number   | Talk-group / contact **index** (`0` = none)  |
| `rxGroupListId`                       | number?  | RX group list id (`0` = none)                |
| `slotOperation`                       | number?  | Slot / TDMA related                          |
| `tdmaDirectMode`                      | boolean? |                                              |
| `encryption`                          | boolean? |                                              |
| `encryptionId`                        | number?  | Key index (`0` = none)                       |
| `dmrRadioIdIndex`                     | number?  | 0-based into `radioIds`; omit / `255` = none |
| `shortDataConfirm` / `privateConfirm` | boolean? |                                              |

Legacy `txContactId` exists in the type but NeonPlug comments mark it deprecated in favour of `contactId`.

## Unknown / radio-layout bitfields

Many `unknown*` fields exist (`unknown1A_6_4`, `unknown1C_1_0`, `unknown2A`, …). They mirror DM32 memory layout.

| Studio export guidance | Prefer documented defaults (`0`, `false`) — do **not** stash imported unknown bits for round-trip. |
| Studio import guidance | Ignore unless a typed library field is added. Document remaining loss. |

## Optional metadata

| Field    | Type   | Notes                                    |
| -------- | ------ | ---------------------------------------- |
| `source` | string | Import attribution; not written to radio |

## Mapping sketch → Studio library

| NeonPlug                          | Studio (directional)                                                                                  |
| --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `rxFrequency` / `txFrequency` MHz | Hz on `Channel`                                                                                       |
| `mode`                            | `Channel` mode / `primaryMode` / mode profiles                                                        |
| `power` enum                      | Percentage or profile ladder at export                                                                |
| `rxCtcssDcs` / `txCtcssDcs`       | Tone model                                                                                            |
| `contactId` index                 | UUID talk-group / contact FK after resolve                                                            |
| `scanAdd`                         | `scanInclusion` / per-channel build override → library ([scan-inclusion.md](../../scan-inclusion.md)) |
| `number`                          | Export-time assignment from assemble / flat memory order                                              |

### Export notes

- Studio ladder wire **`Middle`** maps to NeonPlug **`Medium`**.
- **Receive-only airband / FM band:** when effective `forbidTx` and RX is in **87–136 MHz**, emit `txFrequency: 1666.666` (not `0`) — see [Frequencies](#frequencies) above.
- **DM32UV:** `contactId` / `rxGroupListId` / `scanListId` resolve from library UUID FKs (`0` = none). `scanListId` is 1-based into zone-derived `scanLists[]` (max **15**).
- **UV5R-Mini:** org FKs stay `0`; org arrays empty.
- **DM32UV:** `number` is sequential 1…N in assemble channel order.
- **UV5R-Mini:** `number` is the flat-memory slot from `assemble` (`channelMemorySlots`); blank slots are omitted; FM/AM only (digital-only channels skipped with a warning).
- Unknown / radio-layout bitfields use safe defaults (`0` / `false`) — no stash-and-replay.

Exact column-by-column adapter tables belong with the export/import implementation; this page is the **wire contract**.
