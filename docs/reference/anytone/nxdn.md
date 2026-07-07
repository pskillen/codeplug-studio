# Anytone — NXDN parallel bank

NXDN uses a **parallel CPS file set** mirroring DMR structure, plus global settings and per-channel NXDN tail columns on `Channel.CSV`.

**Fixtures:** header-only NX contact/TG/RGL in [`test-data/anytone/at-d890uv/`](../../../test-data/anytone/at-d890uv/); [`NXSetting.CSV`](../../../test-data/anytone/at-d890uv/NXSetting.CSV) has one settings row.

## File set

| File                         | DMR analogue              | Internal mapping (target)              | Sample body |
| ---------------------------- | ------------------------- | -------------------------------------- | ----------- |
| `NXTalkGroup.CSV`            | `DMRTalkGroups.CSV`       | `TalkGroup` (`mode: 'nxdn'`)           | Empty       |
| `NXDigitalContactList.CSV`   | `DMRDigitalContactList.CSV` | `DigitalContact` (`mode: 'nxdn'`)    | Empty       |
| `NXReceiveGroupCallList.CSV` | `DMRReceiveGroupCallList.CSV` | `RxGroupList` (NX members)         | Empty       |
| `NXSetting.CSV`              | —                         | Opaque global settings                 | 1 row       |
| `NXStateMSG.CSV`             | —                         | Skip                                   | —           |
| `NXEncryptionCode.CSV`       | —                         | Skip                                   | —           |

## NX contact / talk group headers

Shared shape (disambiguate by **filename** on import):

| Header        | Purpose                |
| ------------- | ---------------------- |
| `RADIO_ID`    | NXDN ID                |
| `CALLSIGN`    | Callsign label         |
| `FIRST_NAME`  | Contact metadata       |
| `LAST_NAME`   | Contact metadata       |
| `CITY` … `COUNTRY` | Location fields   |
| `Attr`        | Attribute flags        |
| `TxForbid`    | Transmit forbid        |
| `Ring`        | Ring style             |

## NX receive group list

Same column shape as DMR RGL (`Group Name`, `Contact`, `Contact TG/DMR ID`) — NX member IDs on wire.

## NXSetting.CSV

Single global configuration row (42 columns): `OwnId`, `StationId`, `StationType`, alias/beep/LED/state message fields, `NxdnMoni*` monitor settings, etc. **Not modelled** — export as imported constants or profile defaults until NXDN settings entity is justified.

## Per-channel NXDN columns (`Channel.CSV` tail)

| Column (sample) | Purpose (provisional)        |
| --------------- | ---------------------------- |
| `nxdn_wn`       | NXDN wide/narrow             |
| `NxdnRpga`      | RPGA                         |
| `nxdnSqCon`     | Squelch control              |
| `NxdnTxBusy`    | TX busy                      |
| `NxDnPttId`     | PTT ID                       |
| `EnRan` / `DeRan` | RAN values                 |
| `NxdnEncry`     | Encryption                   |
| `NxdnGroupId`   | Group ID                     |
| `NxdnIdNum`     | ID number                    |
| `NxdnStateNum`  | State number                 |
| `txcc`          | TX colour code (sample)      |

When `Channel Type` indicates NXDN operation, map to `ChannelModeProfileNxdn` (`rxRan`, `txRan`, `unitId`, `talkGroupRef`) — field-level mapping TBD when NXDN channel rows available in fixtures.

## Internal model mapping summary

| Entity            | Status today                          |
| ----------------- | ------------------------------------- |
| `ChannelModeProfileNxdn` | **Exists** in `library.ts`       |
| `TalkGroup` / `DigitalContact` / `RxGroupList` | **Exist** with `mode: 'nxdn'` |
| NX global settings | **Gap** — opaque at boundary       |
| Multi-protocol build partition | **Gap** — may need trait extension beyond DMR-only [#232](https://github.com/pskillen/codeplug-studio/issues/232) |

## Fidelity

| Direction | Status                         |
| --------- | ------------------------------ |
| Import    | Planned ([#229](https://github.com/pskillen/codeplug-studio/issues/229)) |
| Export    | Deferred post-DMR MVP          |

## Related

- [channels.md](channels.md)
- [Data model — ChannelModeProfileNxdn](../../features/data-model/README.md)
- [talk-groups.md](talk-groups.md) — DMR sibling files
