# Anytone — Channel.CSV

Primary DMR (and mixed-mode) channel table for AT-D890UV CPS. **76 columns** in the sample export.

**Fixture:** [`test-data/anytone/at-d890uv/Channel.CSV`](../../../test-data/anytone/at-d890uv/Channel.CSV)

## Required headers (target import)

| Header              | Reason                          |
| ------------------- | ------------------------------- |
| `Channel Name`      | Identity; case-sensitive FK     |
| `Receive Frequency` | RX frequency                    |
| `Channel Type`      | Mode mapping                    |

## Channel Type (observed)

| Wire        | Target internal mapping (provisional)                    |
| ----------- | -------------------------------------------------------- |
| `D-Digital` | `modeProfiles: [{ mode: 'dmr', … }]`                    |
| _(others TBD)_ | Analog / NXDN / mixed types — extend when sample available |

## Core columns — DMR mapping

| Vendor header                    | Internal field / location              | Notes                                      |
| -------------------------------- | -------------------------------------- | ------------------------------------------ |
| `No.`                            | Export slot index                      | VFO rows use high numbers (`4001+`)        |
| `Channel Name`                   | Build `wireName` / `Channel.name`      | Case-sensitive FK                          |
| `Receive Frequency`              | `Channel.rxFrequency`                  | MHz → Hz                                   |
| `Transmit Frequency`             | `Channel.txFrequency`                  | MHz → Hz                                   |
| `Channel Type`                   | `modeProfiles[]`                       | See Channel Type table                     |
| `Transmit Power`                 | `Channel.power`                        | `Low` / `High` / … → % ladder (TBD profile) |
| `Band Width`                     | `modeProfiles[].bandwidthKHz`          | `12.5K` → 12.5                             |
| `CTCSS/DCS Decode` / `Encode`    | `rxTone` / `txTone` on analog profile  | `Off` when none                            |
| `Contact/Talk Group`             | DMR `contactRef`                       | Name FK → talk group or contact            |
| `Contact/Talk Group Call Type`   | Ref kind hint                          | `Group Call` / `Private Call`              |
| `Contact/Talk Group TG/DMR ID`   | `TalkGroup.digitalId` / contact ID     | Denormalised on wire                       |
| `Radio ID`                       | DMR ID label                           | Name FK → `RadioIDList.CSV`                |
| `RX Color Code`                  | `colourCode`                           |                                            |
| `Slot`                           | `timeslot`                             | `1` / `2`                                  |
| `Scan List`                      | Build scan list ref                    | Name FK → `ScanList.CSV`; `None`           |
| `Receive Group List`             | `rxGroupListId`                        | Name FK → `DMRReceiveGroupCallList.CSV`    |
| `PTT Prohibit`                   | `forbidTransmit` or export flag        | TBD                                        |

## Per-channel APRS columns

See [aprs-on-channels.md](aprs-on-channels.md) for `APRS RX`, `Analog APRS PTT Mode`, `Digital APRS PTT Mode`, `APRS Report Type`, `Digital APRS Report Channel`, and related fields. Global APRS settings live in [aprs.md](aprs.md).

## NXDN tail columns

See [nxdn.md](nxdn.md) for `nxdn_wn`, `NxdnRpga`, `EnRan`, `DeRan`, `NxdnGroupId`, and sibling columns on the same row. Populated when channel operates in NXDN mode.

## Deferred / constant columns (v1 export MVP)

Remaining columns (encryption, MDC, R5 tone, roaming flags, `DMR MODE`, talker alias, compand, …) export as fixture defaults or profile constants until modelled. Document loss in export warnings ([#233](https://github.com/pskillen/codeplug-studio/issues/233)).

## Related

- [zones.md](zones.md)
- [scan-lists.md](scan-lists.md)
- [talk-groups.md](talk-groups.md)
- [rx-group-lists.md](rx-group-lists.md)
- [radio-ids.md](radio-ids.md)
