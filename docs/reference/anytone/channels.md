# Anytone — Channel.CSV

Primary DMR (and mixed-mode) channel table for AT-D890UV CPS. **77 columns** in the sample export (header row).

**Fixture:** [`test-data/anytone/at-d890uv/Channel.CSV`](../../../test-data/anytone/at-d890uv/Channel.CSV)

## Required headers (target import)

| Header              | Reason                      |
| ------------------- | --------------------------- |
| `Channel Name`      | Identity; case-sensitive FK |
| `Receive Frequency` | RX frequency                |
| `Channel Type`      | Mode mapping                |

## Channel Type (observed)

| Wire        | Internal mapping                                                                 |
| ----------- | -------------------------------------------------------------------------------- |
| `D-Digital` | DMR-only channel                                                                 |
| `A-Analog`  | FM/AM-only channel                                                               |
| `D+A TX D`  | FM+DMR dual-mode; primary transmit digital (`Channel.primaryMode` = `dmr`)       |
| `A+D TX A`  | FM+DMR dual-mode; primary transmit analog (`Channel.primaryMode` = `fm` or `am`) |

DCDM (double-capacity digital mode) is **not** a channel type — it appears on `DMR MODE` as wire `2` / `3`.

## DMR MODE (observed)

| Wire | Meaning (CPS)    | Internal mapping                                                              |
| ---- | ---------------- | ----------------------------------------------------------------------------- |
| `0`  | DMO / simplex    | `ChannelModeProfileDMR.dmrMode` = `dmo-simplex`, or inferred when equal RX/TX |
| `1`  | Repeater         | `dmrMode` = `repeater`, or inferred when RX ≠ TX                              |
| `2`  | DCDM Double Slot | **Not exported** — document only                                              |
| `3`  | DCDM TS split    | **Not exported** — document only                                              |

## Transmit Power

Wire ladder (AT-D890UV): `Low` / `Mid` / `High` / `Turbo`. Watt mapping and Studio `%` ladder: [radios/at-d890uv.md](radios/at-d890uv.md).

## Busy Lock / TX Permit

Mode-aware CPS enums ([#357](https://github.com/pskillen/codeplug-studio/issues/357)). Export maps resolved `txPermit` from the [behavioural defaults cascade](../channel-behavioural-defaults.md) (library → channel → build):

| Resolved `txPermit` | Analog TX primary (`A-Analog`, `A+D TX A`) | Digital TX primary (`D-Digital`, `D+A TX D`) |
| ------------------- | ------------------------------------------ | -------------------------------------------- |
| `busyLock`          | `Channel Free`                             | `ChannelFree`                                |
| `permitAlways`      | `Off`                                      | `Always`                                     |

CPS-only variants (`Different CDT`, colour-code admits) are **not** modelled in the library.

## Core columns — DMR mapping

| Vendor header                  | Internal field / location             | Notes                                                                                                                                                                      |
| ------------------------------ | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `No.`                          | `channelOverrides.orderOrSlot`        | Programmed rows `1..n`. Official CPS may append VFO slots `4001`/`4002` — **Studio need not emit** them; CPS adds VFO rows on import                                       |
| `Channel Name`                 | Build `wireName` / `Channel.name`     | Case-sensitive FK                                                                                                                                                          |
| `Receive Frequency`            | `Channel.rxFrequency`                 | MHz → Hz                                                                                                                                                                   |
| `Transmit Frequency`           | `Channel.txFrequency`                 | MHz → Hz                                                                                                                                                                   |
| `Channel Type`                 | `modeProfiles[]`, `primaryMode`       | See Channel Type table                                                                                                                                                     |
| `Transmit Power`               | `Channel.power`                       | See Transmit Power + radio profile                                                                                                                                         |
| `Band Width`                   | `modeProfiles[].bandwidthKHz`         | `12.5K` → 12.5                                                                                                                                                             |
| `CTCSS/DCS Decode` / `Encode`  | `rxTone` / `txTone` on analog profile | `Off` when none                                                                                                                                                            |
| `Contact/Talk Group`           | DMR `contactRef`                      | Name FK → talk group or contact                                                                                                                                            |
| `Contact/Talk Group Call Type` | Ref kind hint                         | `Group Call` / `Private Call` / `All Call` (All Call not modelled)                                                                                                         |
| `Contact/Talk Group TG/DMR ID` | `TalkGroup.digitalId` / contact ID    | Denormalised on wire                                                                                                                                                       |
| `Radio ID`                     | DMR ID label                          | Name FK → `RadioIDList.CSV`; list file omitted from export ([#302](https://github.com/pskillen/codeplug-studio/issues/302)); channel column still uses profile placeholder |
| `Busy Lock/TX Permit`          | `txPermit` cascade                    | Resolved `busyLock` / `permitAlways` — see [Busy Lock / TX Permit](#busy-lock--tx-permit)                                                                                   |
| `Squelch Mode`                 | `analogSquelchMode` on analog profile | `carrier` → `Carrier`; `tone` → `CTCSS/DCS` via cascade                                                                                                                    |
| `RX Color Code`                | `colourCode`                          |                                                                                                                                                                            |
| `Slot`                         | `timeslot`                            | `1` / `2`                                                                                                                                                                  |
| `Scan List`                    | Build scan list ref                   | Name FK → `ScanList.CSV`; `None`                                                                                                                                           |
| `Receive Group List`           | `rxGroupListId`                       | Name FK → `DMRReceiveGroupCallList.CSV`                                                                                                                                    |
| `PTT Prohibit`                 | `forbidTransmit`                      | `On` / `Off`                                                                                                                                                               |
| `Slot Suit`                    | Unmodelled (planned)                  | `On` = listen both slots; TX on heard slot (simplex) or programmed slot (repeater)                                                                                         |
| `DMR MODE`                     | `ChannelModeProfileDMR.dmrMode`       | `0` / `1` — see DMR MODE table; inferred from RX/TX when `dmrMode` unset                                                                                                   |
| `DataACK Disable`              | Unmodelled                            | `1` = ignore confirmation requests from repeater for incoming calls/SMS                                                                                                    |
| `Auto Scan`                    | Zone-scan carrier only today          | `1` on synthesised zone-scan carriers; reserve for future library setting                                                                                                  |
| `Send Talker Alias DMR/NX`     | `sendTalkerAlias` on DMR profile      | `on` → `1`, `off` → `0`; `tx_talkalaes` kept in sync                                                                                                                       |
| `txcc`                         | Same as `RX Color Code`               | Split RX/TX colour code not supported — export writes both from library `colourCode` ([#415](https://github.com/pskillen/codeplug-studio/issues/415))                      |

## `Idle TX` vs `idle_tx`

| Wire column | Meaning                                                               | Studio                                      |
| ----------- | --------------------------------------------------------------------- | ------------------------------------------- |
| `Idle TX`   | Appears unused in CPS v1.60 / FW v1.05                                | Always emit `Off`                           |
| `idle_tx`   | CPS UI label “Idle TX”: if programmed TS occupied, TX on the other TS | Always `0` — Anytone-specific; not modelled |

## Per-channel APRS columns

See [aprs-on-channels.md](aprs-on-channels.md) for `APRS RX`, `Analog APRS PTT Mode`, `Digital APRS PTT Mode`, `APRS Report Type`, `Digital APRS Report Channel`, and related fields. Global APRS settings live in [aprs.md](aprs.md).

## NXDN tail columns

See [nxdn.md](nxdn.md). D890 NXDN wire elicitation is deferred to epic [#247](https://github.com/pskillen/codeplug-studio/issues/247).

## Deferred / constant columns (v1 export MVP)

Export as fixture defaults / skip (amateur product) — full checklist: [enum-verification.md](enum-verification.md):

- Encryption (`AES Digital Encryption`, `Digital Encryption`, `ARC4`)
- Analog ident (`Optional Signal`, DTMF/2Tone/5Tone/`PTT ID`, `R5tone*`, `2TONE Decode`)
- `Talk Around(Simplex)`, `Work Alone`, `Ranging`, `Correct Frequency[Hz]`, `Distur*`
- `Exclude channel from roaming` (roaming epic later)
- `compand` (possible future analog flag)
- Professional: `tx_int`, `ex_emg_kind`, …

`DMR MODE` and `Channel Type` are projected from the library model ([#311](https://github.com/pskillen/codeplug-studio/issues/311), [#303](https://github.com/pskillen/codeplug-studio/issues/303)). Busy Lock, Talker Alias, and Squelch Mode export from the behavioural cascade ([#422](https://github.com/pskillen/codeplug-studio/issues/422)).

## Related

- [zones.md](zones.md)
- [scan-lists.md](scan-lists.md)
- [talk-groups.md](talk-groups.md)
- [rx-group-lists.md](rx-group-lists.md)
- [radio-ids.md](radio-ids.md)
- [enum-verification.md](enum-verification.md)
