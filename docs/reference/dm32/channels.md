# DM32 — Channels.csv

Baofeng DM-32UV stock CPS `Channels.csv` (40 columns, v1.60). Cardinality and ladders: [radios/baofeng-dm32uv.md](radios/baofeng-dm32uv.md).

**Code:** [`columns.ts`](../../../src/core/import-export/formats/dm32/columns.ts) · [`parse.ts`](../../../src/core/import-export/formats/dm32/parse.ts) · [`serialise.ts`](../../../src/core/import-export/formats/dm32/serialise.ts)

## Required headers (app import)

| Header | Reason |
| --- | --- |
| `Channel Name` | Identity; rows without a name are skipped |
| `Channel Type` | Mode / dual-mode mapping |

## Channel Type

| Wire | Internal |
| --- | --- |
| `Analog` | `mode: fm`, `multiMode: false` |
| `Digital` | `mode: dmr`, `multiMode: false` |
| `Fixed Analog` | `multiMode: true`, primary TX analog (`fm` profile) |
| `Fixed Digital` | `multiMode: true`, primary TX digital (`dmr` profile) |

Some CPS builds spell analogue `Anlaog` — accept on import; export uses fixture spelling from model.

## Column reference

| Vendor header | Internal field | Import | Export | Bidirectional mapping | Notes |
| --- | --- | --- | --- | --- | --- |
| `No.` | _(export only)_ | Ignored | Sequential `1…n` | **Excluded** | |
| `Channel Name` | `Channel.name` | Trim | As stored | Yes | Case-sensitive FK |
| `Channel Type` | `mode` / `multiMode` / `modeProfiles` | See above | From profiles | Yes | |
| `RX Frequency[MHz]` | `rxFrequency` | MHz → Hz | Hz → MHz (5 dp) | Yes | |
| `TX Frequency[MHz]` | `txFrequency` | MHz → Hz; empty → `null` | Hz → MHz or empty | Yes | RX-only airband |
| `Power` | `power` | Wire → % via ladder | % → `High`/`Middle`/`Low` | Yes | |
| `Band Width` | `bandwidthKHz` | `12.5KHz` → 12.5; `25KHz` → 25 | Reverse | Yes | |
| `Scan List` | — | **Ignored** | `None` | **Lossy** — archive reference #125 | |
| `TX Admit` | `txAdmit` | Wire → enum | Enum → wire | Yes | See mapping table below |
| `Emergency System` | — | Ignored | `None` | Constant default | |
| `Squelch Level` | `squelch` | 0–9 → % via ladder | % → 0–9; `null` → `1` on analog rows only, else `0` | Yes | |
| `APRS Report Type` | `aprsReportType` | Trim | As stored | Yes | `Off` / `Digital` |
| `Forbid TX` | `forbidTransmit` | 0/1 | 0/1 | Yes | Receive-only when `1` |
| `APRS Receive` | `aprsReceiveEnabled` | 0/1 | 0/1 | Yes | |
| `Forbid Talkaround` | `forbidTalkaround` | 0/1 | 0/1 | Yes | |
| `Auto Scan` … `Digital APRS PTT Mode` | — | Ignored | Fixture defaults (`0`) | Constant | |
| `TX Contact` | `contactRef` | Name → ref | Ref → name or `None` | Yes | FK → Talkgroups / Contacts |
| `RX Group List` | `rxGroupListId` | Name or `ALL` → ref | Ref → name; `ALL` sentinel | Yes | See [multi-talkgroup.md](multi-talkgroup.md) |
| `Color Code` | `colourCode` | Parse int | As string | Yes | `0` analogue |
| `Time Slot` | `timeslot` | `Slot 1`/`Slot 2` → 1/2 | Reverse | Yes | |
| `Encryption` / `Encryption ID` | — | Ignored | `0` / `None` | Constant | |
| `APRS Report Channel` | `aprsReportChannel` | Parse int | As string | Yes | `1` digital; `256` analogue default |
| `Direct Dual Mode` | `directDualMode` | 0/1 | 0/1 | Yes | |
| `Private Confirm` / `Short Data Confirm` | — | Ignored | `0` | Constant | |
| `DMR ID` | — | **Ignored** | Fixture default `Paddy MM7IGV` | **Lossy** | Accepted gap |
| `CTC/DCS Decode` / `Encode` | `rxTone` / `txTone` | Wire → tone | Tone → wire | Yes | `None` when off |
| `Scramble` … `PTT ID Display` | — | Ignored | Fixture defaults | Constant | |

### TX Admit mapping

| Internal `txAdmit` | DM-32 `TX Admit` wire |
| --- | --- |
| `channel_idle` | `Channel Idle` |
| `allow_tx` | `Allow TX` |
| _(unknown wire on import)_ | → `channel_idle` |

`Channel Name` maps to split internal fields on import and is **composed on export**. Split rules: [channel-name-parsing](../../features/channel-name-parsing.md).

## Export name length and shortening

Default profile `nameLimit` is **16** (`src/core/import-export/formats/dm32/profiles.ts`). Expanded multi-talkgroup row names share the same shortening pipeline as OpenGD77; zone member wire names match shortened channel names. See name shortening (Phase 4+).

## Export expansion (DM32 adapter)

| Flag | Value | Reason |
| --- | --- | --- |
| `expandModes` | `false` | Native `Fixed Analog` / `Fixed Digital` on one row |
| `expandRxGroupLists` | `true` with guards | Expand only merged logical channels; skip when TX contact + RGL both set; skip `ALL` list |

See [multi-mode.md](multi-mode.md) and [multi-talkgroup.md](multi-talkgroup.md).
