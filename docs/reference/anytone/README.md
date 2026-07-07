# Anytone CPS CSV reference

> **Studio status:** Wire reference from operator AT-D890UV CPS export (Phase 7 wire spike [#230](https://github.com/pskillen/codeplug-studio/issues/230)); import/export adapters planned under `src/core/import-export/formats/anytone/`.

Authoritative reference for **Anytone Customer Programming Software (CPS) CSV** exports — one wire format among several at the import/export boundary (siblings: OpenGD77, DM32, CHIRP, …).

**Format:** `anytone` · **First variant:** `anytone-at-d890uv` (AT-D890UV) · **Tracking:** [#228](https://github.com/pskillen/codeplug-studio/issues/228)

## Two-layer model

| Layer                   | Location                      | Contents                                                                  |
| ----------------------- | ----------------------------- | ------------------------------------------------------------------------- |
| **Generic wire format** | This directory                | Column headers, semantic mapping, import/export fidelity tiers            |
| **Radio profiles**      | [`radios/`](radios/README.md) | Per-radio limits (channel caps, name length, member counts) — provisional |

The **internal library model is format-agnostic** ([data model](../../features/data-model/README.md)). Anytone constraints apply at **export time** when the operator picks `anytone-at-d890uv`.

## File inventory (AT-D890UV export-all)

Committed fixture: [`test-data/anytone/at-d890uv/`](../../../test-data/anytone/at-d890uv/).

| File                                    | Reference                              | Model mapping        | Import (target) | Export (target) | Notes                                   |
| --------------------------------------- | -------------------------------------- | -------------------- | --------------- | --------------- | --------------------------------------- |
| `Channel.CSV`                           | [channels.md](channels.md)             | **Modelled**         | Yes             | Yes             | DMR/mixed modes; 76 columns             |
| `DMRZone.CSV`                           | [zones.md](zones.md)                   | **Build layout**     | Yes             | Yes             | Zone grouping trait                     |
| `ScanList.CSV`                          | [scan-lists.md](scan-lists.md)         | **Build layout**     | Yes             | Yes             | Dedicated scan lists                    |
| `DMRTalkGroups.CSV`                     | [talk-groups.md](talk-groups.md)       | **Modelled**         | Yes             | Yes             | `TalkGroup` (`mode: dmr`)               |
| `DMRDigitalContactList.CSV`             | [talk-groups.md](talk-groups.md)       | **Modelled**         | Yes             | Yes             | `DigitalContact` (`mode: dmr`)          |
| `DMRReceiveGroupCallList.CSV`           | [rx-group-lists.md](rx-group-lists.md) | **Modelled**         | Yes             | Yes             | `RxGroupList[]`                         |
| `RadioIDList.CSV`                       | [radio-ids.md](radio-ids.md)           | **Profile / build**  | Yes             | Yes             | DMR ID label referenced from channels   |
| `AMAir.CSV`                             | [am-air.md](am-air.md)                 | Maps to `Channel`    | Planned         | Deferred        | AM airband receive bank                 |
| `AMZone.CSV`                            | [am-air.md](am-air.md)                 | Maps to build layout | Planned         | Deferred        | AM zone (header-only in sample fixture) |
| `FM.CSV`                                | [fm-broadcast.md](fm-broadcast.md)     | Maps to `Channel`    | Planned         | Deferred        | Broadcast FM receive bank               |
| `APRS.CSV`                              | [aprs.md](aprs.md)                     | **New model needed** | Planned         | Header/defaults | Global APRS config (~150 columns)       |
| `NXTalkGroup.CSV`                       | [nxdn.md](nxdn.md)                     | Maps partially       | Planned         | Deferred        | NXDN talk groups                        |
| `NXDigitalContactList.CSV`              | [nxdn.md](nxdn.md)                     | Maps partially       | Planned         | Deferred        | NXDN contacts                           |
| `NXReceiveGroupCallList.CSV`            | [nxdn.md](nxdn.md)                     | Maps partially       | Planned         | Deferred        | NXDN RX group lists                     |
| `NXSetting.CSV`                         | [nxdn.md](nxdn.md)                     | Skip / opaque        | Skip            | Deferred        | Global NXDN settings row                |
| `NXStateMSG.CSV`                        | [nxdn.md](nxdn.md)                     | Skip                 | Skip            | Skip            | NXDN state messages                     |
| `NXEncryptionCode.CSV`                  | [nxdn.md](nxdn.md)                     | Skip                 | Skip            | Skip            | Encryption                              |
| `2ToneEncode.CSV`                       | —                                      | Skip                 | Skip            | Skip            | Tone encode tables                      |
| `5ToneEncode.CSV`                       | —                                      | Skip                 | Skip            | Skip            | Tone encode tables                      |
| `DTMFEncode.CSV`                        | —                                      | Skip                 | Skip            | Skip            | DTMF encode                             |
| `AnalogAddressBook.CSV`                 | —                                      | Skip                 | Skip            | Skip            | Analog address book                     |
| `EncryptionCode.CSV`                    | —                                      | Skip                 | Skip            | Skip            | Encryption keys                         |
| `AESEncryptionCode.CSV`                 | —                                      | Skip                 | Skip            | Skip            | AES keys                                |
| `ARC4EncryptionCode.CSV`                | —                                      | Skip                 | Skip            | Skip            | ARC4 keys                               |
| `AlertTone.CSV`                         | —                                      | Skip                 | Skip            | Skip            | Alert tones                             |
| `OptionalSetting.CSV`                   | —                                      | Skip                 | Skip            | Skip            | Radio-wide settings (single wide row)   |
| `GPSRoaming.CSV`                        | —                                      | Skip                 | Skip            | Skip            | GPS roaming                             |
| `RoamingChannel.CSV`                    | —                                      | Skip                 | Skip            | Skip            | DMR roaming channels                    |
| `RoamingZone.CSV`                       | —                                      | Skip                 | Skip            | Skip            | Roaming zones                           |
| `HotKey_HotKey.CSV`                     | —                                      | Skip                 | Skip            | Skip            | Hot keys                                |
| `HotKey_QuickCall.CSV`                  | —                                      | Skip                 | Skip            | Skip            | Quick call                              |
| `HotKey_State.CSV`                      | —                                      | Skip                 | Skip            | Skip            | State hot keys                          |
| `MDC1200AddressBook.CSV`                | —                                      | Skip                 | Skip            | Skip            | MDC1200                                 |
| `MDC1200Encode.CSV`                     | —                                      | Skip                 | Skip            | Skip            | MDC1200                                 |
| `PrefabricatedSMS.CSV`                  | —                                      | Skip                 | Skip            | Skip            | SMS templates                           |
| `AutoRepeaterOffsetFrequencys.CSV`      | —                                      | Skip                 | Skip            | Skip            | Repeater offsets                        |
| `DigitalContactWhitelist(Repeater).CSV` | —                                      | Skip                 | Skip            | Skip            | Repeater whitelist                      |
| `TalkGroupWhitelist(Repeater).CSV`      | —                                      | Skip                 | Skip            | Skip            | Repeater whitelist                      |
| `meep.LST`                              | —                                      | Skip                 | Skip            | Skip            | Non-CSV sidecar; not parsed             |

Cross-cutting rules: [file-format.md](file-format.md).

## Trait profile recommendation (for #232)

Evidence from wire layout — code change deferred to scaffold ticket:

| Trait                              | Evidence                                       |
| ---------------------------------- | ---------------------------------------------- |
| `zoneGrouping`                     | `DMRZone.CSV` with named members + A/B channel |
| `scanLists`                        | Dedicated `ScanList.CSV` (not zone-as-scan)    |
| _(not)_ `zoneAsScanList`           | Scan lists are first-class files               |
| _(not)_ `multiTalkGroupPerChannel` | Native `DMRReceiveGroupCallList.CSV`           |
| _(not)_ `mxnChannelExpansion`      | Single TG + RGL per channel row in sample      |

Extended banks (AM air, FM, NXDN, APRS) documented separately; export projection / traits TBD — see [anytone-outstanding.md](../../features/import-export/anytone-outstanding.md).

## Classification (`detectKind` — target for import #229)

Parse by **header name**, disambiguate with **filename** when headers overlap.

| Signal                                                                                 | Kind                  |
| -------------------------------------------------------------------------------------- | --------------------- |
| Headers include `Channel Name` + `Receive Frequency` + `Channel Type`                  | `channels`            |
| Headers include `Zone Name` + `Zone Channel Member` + filename contains `DMRZone`      | `zones`               |
| Headers include `Scan List Name`                                                       | `scanLists`           |
| Headers include `Group Name` + `Contact TG/DMR ID` + filename contains `DMRReceive`    | `rxGroupLists`        |
| Headers include `Radio ID` + `Name` + `Call Type` (no `Callsign`) + filename `DMRTalk` | `talkGroups`          |
| Headers include `Callsign` + `Call Type` + filename `DMRDigitalContact`                | `contacts`            |
| Headers `Radio ID` + `Name` only (two columns after `No.`) + filename `RadioIDList`    | `radioIds`            |
| Headers `Frequency[MHz]` + `Name` only + filename `AMAir`                              | `amAirChannels`       |
| Headers `Frequency[MHz]` + `Scan` + `Name` + filename `FM`                             | `fmBroadcastChannels` |
| Filename `APRS` or headers include `Your Call Sign` + `Digipeater Path`                | `aprsConfig`          |
| Filename `NXTalkGroup`                                                                 | `nxdnTalkGroups`      |
| Filename `NXDigitalContactList`                                                        | `nxdnContacts`        |
| Headers `Group Name` + filename contains `NXReceive`                                   | `nxdnRxGroupLists`    |
| Filename `NXSetting`                                                                   | `nxdnSettings`        |
| Otherwise                                                                              | `unknown` → skipped   |

## Skip vs error (target)

| Outcome        | When                                                     |
| -------------- | -------------------------------------------------------- |
| **Skipped**    | Unknown files, encryption, hotkeys, optional settings, … |
| **Error**      | Recognised file fails parse (missing required columns)   |
| **Recognised** | Rows above that map to library or build layout           |

## D878 vs D890

Sibling Anytone models (AT-D878UV, AT-D578UV, …) may differ in filename casing, column sets, or file inventory. This reference is calibrated to **AT-D890UV export-all** only. Cross-model deltas belong as footnotes here — not assumed for other variants.

## Related

- [Feature hub](../../features/import-export/anytone/README.md)
- [Data model](../../features/data-model/README.md)
- [OpenGD77 reference](../opengd77/README.md) — sibling format
- [DM32 reference](../dm32/README.md) — sibling multi-file DMR format
