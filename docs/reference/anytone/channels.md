# Anytone — Channel.CSV

Primary DMR (and mixed-mode) channel table for AT-D890UV CPS. **76 columns** in the sample export.

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

## DMR MODE (observed)

| Wire | Internal mapping                                                              |
| ---- | ----------------------------------------------------------------------------- |
| `0`  | `ChannelModeProfileDMR.dmrMode` = `dmo-simplex`, or inferred when equal RX/TX |
| `1`  | `dmrMode` = `repeater`, or inferred when RX ≠ TX                              |

Values `2` / `3` (DCDM) are not modelled in the library yet.

## Busy Lock / TX Permit

Mode-aware CPS enums ([#357](https://github.com/pskillen/codeplug-studio/issues/357)):

| Channel Type (TX primary)         | Allowed wire values (CPS)                                          | Studio export today                                  |
| --------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------- |
| Analog (`A-Analog`, `A+D TX A`)   | `Off`, `Different CDT`, `Channel Free`                             | Always `Channel Free`                                |
| Digital (`D-Digital`, `D+A TX D`) | `Always`, `ChannelFree`, `Different Color Code`, `Same Color Code` | Always `ChannelFree` (`Off` is not valid on digital) |

No library field yet — configurable values land with [#388](https://github.com/pskillen/codeplug-studio/issues/388) / [#396](https://github.com/pskillen/codeplug-studio/issues/396). Until then export is a fixed provisional default (not stash-and-replay).

## Core columns — DMR mapping

| Vendor header                  | Internal field / location             | Notes                                                                                                                                                                      |
| ------------------------------ | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `No.`                          | `channelOverrides.orderOrSlot`        | 1-based CPS slot; VFO rows use fixed high numbers (`4001+`) — same build override field as CHIRP `Location` ([#243](https://github.com/pskillen/codeplug-studio/pull/243)) |
| `Channel Name`                 | Build `wireName` / `Channel.name`     | Case-sensitive FK                                                                                                                                                          |
| `Receive Frequency`            | `Channel.rxFrequency`                 | MHz → Hz                                                                                                                                                                   |
| `Transmit Frequency`           | `Channel.txFrequency`                 | MHz → Hz                                                                                                                                                                   |
| `Channel Type`                 | `modeProfiles[]`, `primaryMode`       | `D-Digital` / `A-Analog` single-mode; `D+A TX D` / `A+D TX A` when FM+DMR dual-mode (primary from `Channel.primaryMode`)                                                   |
| `Transmit Power`               | `Channel.power`                       | `Low` / `High` / … → % ladder (TBD profile)                                                                                                                                |
| `Band Width`                   | `modeProfiles[].bandwidthKHz`         | `12.5K` → 12.5                                                                                                                                                             |
| `CTCSS/DCS Decode` / `Encode`  | `rxTone` / `txTone` on analog profile | `Off` when none                                                                                                                                                            |
| `Contact/Talk Group`           | DMR `contactRef`                      | Name FK → talk group or contact                                                                                                                                            |
| `Contact/Talk Group Call Type` | Ref kind hint                         | `Group Call` / `Private Call`                                                                                                                                              |
| `Contact/Talk Group TG/DMR ID` | `TalkGroup.digitalId` / contact ID    | Denormalised on wire                                                                                                                                                       |
| `Radio ID`                     | DMR ID label                          | Name FK → `RadioIDList.CSV`; list file omitted from export ([#302](https://github.com/pskillen/codeplug-studio/issues/302)); channel column still uses profile placeholder |
| `Busy Lock/TX Permit`          | _(not modelled)_                      | Provisional export default — see [Busy Lock / TX Permit](#busy-lock--tx-permit)                                                                                            |
| `RX Color Code`                | `colourCode`                          |                                                                                                                                                                            |
| `Slot`                         | `timeslot`                            | `1` / `2`                                                                                                                                                                  |
| `Scan List`                    | Build scan list ref                   | Name FK → `ScanList.CSV`; `None`                                                                                                                                           |
| `Receive Group List`           | `rxGroupListId`                       | Name FK → `DMRReceiveGroupCallList.CSV`                                                                                                                                    |
| `PTT Prohibit`                 | `forbidTransmit` or export flag       | TBD                                                                                                                                                                        |
| `DMR MODE`                     | `ChannelModeProfileDMR.dmrMode`       | `0` / `1` — see DMR MODE table; inferred from RX/TX when `dmrMode` unset                                                                                                   |

## Per-channel APRS columns

See [aprs-on-channels.md](aprs-on-channels.md) for `APRS RX`, `Analog APRS PTT Mode`, `Digital APRS PTT Mode`, `APRS Report Type`, `Digital APRS Report Channel`, and related fields. Global APRS settings live in [aprs.md](aprs.md).

## NXDN tail columns

See [nxdn.md](nxdn.md) for `nxdn_wn`, `NxdnRpga`, `EnRan`, `DeRan`, `NxdnGroupId`, and sibling columns on the same row. Populated when channel operates in NXDN mode.

## Deferred / constant columns (v1 export MVP)

Remaining columns (encryption, MDC, R5 tone, roaming flags, talker alias, compand, …) export as fixture defaults until modelled. `DMR MODE` and `Channel Type` are projected from the library model ([#311](https://github.com/pskillen/codeplug-studio/issues/311), [#303](https://github.com/pskillen/codeplug-studio/issues/303)). `Busy Lock/TX Permit` uses a fixed mode-aware provisional default ([#396](https://github.com/pskillen/codeplug-studio/issues/396)).

## Related

- [zones.md](zones.md)
- [scan-lists.md](scan-lists.md)
- [talk-groups.md](talk-groups.md)
- [rx-group-lists.md](rx-group-lists.md)
- [radio-ids.md](radio-ids.md)
