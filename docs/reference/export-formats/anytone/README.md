# Anytone CPS CSV reference

> **Studio status:** Wire reference from operator AT-D890UV CPS export (Phase 7 wire spike [#230](https://github.com/pskillen/codeplug-studio/issues/230)). Export adapter shipped under `src/core/import-export/formats/anytone/` ([#228](https://github.com/pskillen/codeplug-studio/issues/228)); import deferred to [#229](https://github.com/pskillen/codeplug-studio/issues/229). Code ↔ docs mop-up: [#402](https://github.com/pskillen/codeplug-studio/issues/402).

Authoritative reference for **Anytone Customer Programming Software (CPS) CSV** exports — one wire format among several at the import/export boundary (siblings: OpenGD77, DM32, CHIRP, …).

**Format:** `anytone` · **First variant:** `anytone-at-d890uv` (AT-D890UV) · **Tracking:** [#228](https://github.com/pskillen/codeplug-studio/issues/228)

## Two-layer model

| Layer                   | Location                                                  | Contents                                                         |
| ----------------------- | --------------------------------------------------------- | ---------------------------------------------------------------- |
| **Generic wire format** | This directory                                            | Column headers, semantic mapping, import/export fidelity tiers   |
| **Radio profiles**      | [`profiles.md`](profiles.md) · [`radios/`](../../radios/) | Studio `profileId` → radio home; caps provisional in radios tree |

The **internal library model is format-agnostic** ([data model](../../../features/data-model/README.md)). Anytone constraints apply at **export time** when the operator picks `anytone-at-d890uv`.

## File inventory (AT-D890UV export-all)

Committed fixture: [`test-data/anytone/at-d890uv/`](../../../../test-data/anytone/at-d890uv/).

| File                                    | Reference                              | Model mapping        | Import (target) | Export (target)      | Notes                                                                                                                                   |
| --------------------------------------- | -------------------------------------- | -------------------- | --------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `Channel.CSV`                           | [channels.md](channels.md)             | **Modelled**         | Yes             | Yes                  | DMR/mixed modes; 77 columns                                                                                                             |
| `DMRZone.CSV`                           | [zones.md](zones.md)                   | **Build layout**     | Yes             | Yes                  | Zone grouping trait                                                                                                                     |
| `ScanList.CSV`                          | [scan-lists.md](scan-lists.md)         | **Build layout**     | Yes             | Yes                  | Dedicated scan lists                                                                                                                    |
| `DMRTalkGroups.CSV`                     | [talk-groups.md](talk-groups.md)       | **Modelled**         | Yes             | Yes                  | `TalkGroup` (`mode: dmr`)                                                                                                               |
| `DMRDigitalContactList.CSV`             | [talk-groups.md](talk-groups.md)       | **Modelled**         | Yes             | Yes                  | `DigitalContact` (`mode: dmr`)                                                                                                          |
| `DMRReceiveGroupCallList.CSV`           | [rx-group-lists.md](rx-group-lists.md) | **Modelled**         | Yes             | Yes                  | `RxGroupList[]`                                                                                                                         |
| `RadioIDList.CSV`                       | [radio-ids.md](radio-ids.md)           | **Unmodelled**       | Yes             | **Omit**             | Export omitted until radio IDs modelled ([#302](https://github.com/pskillen/codeplug-studio/issues/302)) — placeholder rows clobber CPS |
| `AMAir.CSV`                             | [am-air.md](am-air.md)                 | Maps to `Channel`    | Planned         | Yes                  | AM airband receive bank ([#267](https://github.com/pskillen/codeplug-studio/issues/267))                                                |
| `AMZone.CSV`                            | [am-air.md](am-air.md)                 | Maps to build layout | Planned         | Shipped              | Partitioned from build zones ([#316](https://github.com/pskillen/codeplug-studio/issues/316))                                           |
| `FM.CSV`                                | [fm-broadcast.md](fm-broadcast.md)     | Maps to `Channel`    | Planned         | Yes (when non-empty) | Broadcast FM receive bank ([#268](https://github.com/pskillen/codeplug-studio/issues/268)); **no `FMZone.CSV` on D890**                 |
| `APRS.CSV`                              | [aprs.md](aprs.md)                     | `AprsConfiguration`  | Shipped         | Model + defaults     | Global APRS config (176 columns); export v1 modelled subset ([#251](https://github.com/pskillen/codeplug-studio/issues/251))            |
| `NXTalkGroup.CSV`                       | [nxdn.md](nxdn.md)                     | Maps partially       | Planned         | Deferred             | NXDN talk groups                                                                                                                        |
| `NXDigitalContactList.CSV`              | [nxdn.md](nxdn.md)                     | Maps partially       | Planned         | Deferred             | NXDN contacts                                                                                                                           |
| `NXReceiveGroupCallList.CSV`            | [nxdn.md](nxdn.md)                     | Maps partially       | Planned         | Deferred             | NXDN RX group lists                                                                                                                     |
| `NXSetting.CSV`                         | [nxdn.md](nxdn.md)                     | Skip / opaque        | Skip            | Deferred             | Global NXDN settings row                                                                                                                |
| `NXStateMSG.CSV`                        | [nxdn.md](nxdn.md)                     | Skip                 | Skip            | Skip                 | NXDN state messages                                                                                                                     |
| `NXEncryptionCode.CSV`                  | [nxdn.md](nxdn.md)                     | Skip                 | Skip            | Skip                 | Encryption                                                                                                                              |
| `2ToneEncode.CSV`                       | —                                      | Skip                 | Skip            | Skip                 | Tone encode tables                                                                                                                      |
| `5ToneEncode.CSV`                       | —                                      | Skip                 | Skip            | Skip                 | Tone encode tables                                                                                                                      |
| `DTMFEncode.CSV`                        | —                                      | Skip                 | Skip            | Skip                 | DTMF encode                                                                                                                             |
| `AnalogAddressBook.CSV`                 | —                                      | Skip                 | Skip            | Skip                 | Analog address book                                                                                                                     |
| `EncryptionCode.CSV`                    | —                                      | Skip                 | Skip            | Skip                 | Encryption keys                                                                                                                         |
| `AESEncryptionCode.CSV`                 | —                                      | Skip                 | Skip            | Skip                 | AES keys                                                                                                                                |
| `ARC4EncryptionCode.CSV`                | —                                      | Skip                 | Skip            | Skip                 | ARC4 keys                                                                                                                               |
| `AlertTone.CSV`                         | —                                      | Skip                 | Skip            | Skip                 | Alert tones                                                                                                                             |
| `OptionalSetting.CSV`                   | —                                      | Skip                 | Skip            | Skip                 | Radio-wide settings — skip (Studio is not a full Anytone CPS) ([#357](https://github.com/pskillen/codeplug-studio/issues/357))          |
| `GPSRoaming.CSV`                        | —                                      | Skip                 | Skip            | Skip                 | GPS roaming — future DMR roaming epic under [#1](https://github.com/pskillen/codeplug-studio/issues/1)                                  |
| `RoamingChannel.CSV`                    | —                                      | Skip                 | Skip            | Skip                 | DMR roaming channels — same epic                                                                                                        |
| `RoamingZone.CSV`                       | —                                      | Skip                 | Skip            | Skip                 | Roaming zones — same epic                                                                                                               |
| `HotKey_HotKey.CSV`                     | —                                      | Skip                 | Skip            | Skip                 | Hot keys — skip                                                                                                                         |
| `HotKey_QuickCall.CSV`                  | —                                      | Skip                 | Skip            | Skip                 | Quick call — skip                                                                                                                       |
| `HotKey_State.CSV`                      | —                                      | Skip                 | Skip            | Skip                 | State hot keys — skip                                                                                                                   |
| `MDC1200AddressBook.CSV`                | —                                      | Skip                 | Skip            | Skip                 | MDC1200                                                                                                                                 |
| `MDC1200Encode.CSV`                     | —                                      | Skip                 | Skip            | Skip                 | MDC1200                                                                                                                                 |
| `PrefabricatedSMS.CSV`                  | —                                      | Skip                 | Skip            | Skip                 | SMS templates                                                                                                                           |
| `AutoRepeaterOffsetFrequencys.CSV`      | —                                      | Skip                 | Skip            | Skip                 | Repeater offsets                                                                                                                        |
| `DigitalContactWhitelist(Repeater).CSV` | —                                      | Skip                 | Skip            | Skip                 | Repeater whitelist                                                                                                                      |
| `TalkGroupWhitelist(Repeater).CSV`      | —                                      | Skip                 | Skip            | Skip                 | Repeater whitelist                                                                                                                      |
| `meep.LST`                              | [lst-manifest.md](lst-manifest.md)     | Skip                 | Skip            | **Yes**              | CPS manifest sidecar — export only; lists ZIP CSV members                                                                               |

Cross-cutting rules: [file-format.md](file-format.md). Enum elicitation checklist: [enum-verification.md](enum-verification.md) ([#357](https://github.com/pskillen/codeplug-studio/issues/357); absorbs [#307](https://github.com/pskillen/codeplug-studio/issues/307)). External wire-shape verifier: [wire-verification.md](../../../build/testing/wire-verification.md) ([#480](https://github.com/pskillen/codeplug-studio/issues/480)).

## Trait profile recommendation (for #232)

Evidence from wire layout — code change deferred to scaffold ticket:

| Trait                              | Evidence                                                                                           |
| ---------------------------------- | -------------------------------------------------------------------------------------------------- |
| `zoneGrouping`                     | `DMRZone.CSV` with named members + A/B channel                                                     |
| `scanLists`                        | Dedicated `ScanList.CSV` (not zone-as-scan) — shipped as `DedicatedScanLists` + library `ScanList` |
| _(not)_ `zoneAsScanList`           | Scan lists are first-class files                                                                   |
| _(not)_ `multiTalkGroupPerChannel` | Native `DMRReceiveGroupCallList.CSV`                                                               |
| _(not)_ `mxnChannelExpansion`      | Single TG + RGL per channel row in sample                                                          |

Extended banks: AM air / broadcast FM / APRS export shipped when applicable; NXDN deferred — see [anytone-outstanding.md](../../../features/import-export/anytone-outstanding.md).

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

- [Feature hub](../../../features/import-export/anytone/README.md)
- [Data model](../../../features/data-model/README.md)
- [OpenGD77 reference](../opengd77/README.md) — sibling format
- [DM32 reference](../dm32/README.md) — sibling multi-file DMR format
