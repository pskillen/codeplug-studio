# Baofeng DM32 CPS CSV reference

> **Studio status:** Wire reference ported from [codeplug-tool](https://github.com/pskillen/codeplug-tool); DM32 import/export adapters ship Phase 4–6 under `src/core/import-export/formats/dm32/`.

Authoritative reference for **Baofeng DM-32UV stock CPS** CSV exports (v1.60+). One wire format among several at the import/export boundary.

**Tracking:** archive reference (codeplug-tool#67)

## File inventory (v1.60)

| File               | Reference                              | Studio import                                                          | Studio export          | Modelled                                                                                                      |
| ------------------ | -------------------------------------- | ---------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| `Channels.csv`     | [channels.md](channels.md)             | Planned [#112](https://github.com/pskillen/codeplug-studio/issues/112) | Yes                    | `Channel[]` (`modeProfiles`)                                                                                  |
| `Zones.csv`        | [zones.md](zones.md)                   | Planned [#112](https://github.com/pskillen/codeplug-studio/issues/112) | Yes                    | Build **zone grouping** trait layout                                                                          |
| `Talkgroups.csv`   | [talkgroups.md](talkgroups.md)         | Planned [#112](https://github.com/pskillen/codeplug-studio/issues/112) | Yes                    | `TalkGroup[]`                                                                                                 |
| `Contacts.csv`     | [contacts.md](contacts.md)             | Planned [#112](https://github.com/pskillen/codeplug-studio/issues/112) | Yes                    | `DigitalContact[]`                                                                                            |
| `RXGroupLists.csv` | [rx-group-lists.md](rx-group-lists.md) | Planned [#112](https://github.com/pskillen/codeplug-studio/issues/112) | Yes                    | `RxGroupList[]`                                                                                               |
| `DTMFContacts.csv` | [dtmf-contacts.md](dtmf-contacts.md)   | Planned [#112](https://github.com/pskillen/codeplug-studio/issues/112) | Yes                    | `AnalogContact[]`                                                                                             |
| `Scan.csv`         | [scan-lists.md](scan-lists.md)         | **Skip**                                                               | **Yes** (zone-derived) | Export synthesis from zone layout — [zone-derived-scan-lists.md](../zone-derived-scan-lists.md)               |
| `APRS.md`          | [aprs.md](aprs.md)                     | N/A                                                                    | **Yes** (when config)  | Operator CPS setup guide — no CPS `APRS.csv` ([#250](https://github.com/pskillen/codeplug-studio/issues/250)) |
| `DMR-ID.csv`       | —                                      | **Skip**                                                               | **Skip**               | Accepted gap                                                                                                  |

Committed fixture: [`test-data/baofeng-dm32/v1.60/`](../../../test-data/baofeng-dm32/v1.60/).

## Wire elicitation

Human-led CPS v1.60 column/enum elicitation (supersedes [#356](https://github.com/pskillen/codeplug-studio/issues/356)): [#404](https://github.com/pskillen/codeplug-studio/issues/404). Worksheet lands as [`enum-verification.md`](enum-verification.md) on the `#404` branch until that PR merges — use the issue for status meanwhile.

Docs drift vs shipped export tracked in [#444](https://github.com/pskillen/codeplug-studio/issues/444) (this update).

## Line endings

| Property     | Value                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------ |
| Line endings | **CRLF** on Studio export for all DM32 CSV files; normalise to LF in tests when comparing committed fixtures |

Official Baofeng DM-32UV CPS exports use Windows (CRLF) line endings. Studio DM32 export matches ([#314](https://github.com/pskillen/codeplug-studio/issues/314)). Import parsing accepts both LF and CRLF.

## Filename quirks

- v1.60 CPS uses **PascalCase** (`Channels.csv`, `Scan.csv`).
- Operator-repo exports may use lowercase (`channels.csv`, `scanlist.csv`).
- Some CPS builds save `channels.csv.csv` — rename to `channels.csv` before import.

## Foreign keys (name-based at wire edge)

| Column                     | Target file                          |
| -------------------------- | ------------------------------------ |
| Channel `TX Contact`       | `Talkgroups.csv` or `Contacts.csv`   |
| Channel `RX Group List`    | `RXGroupLists.csv` or sentinel `ALL` |
| Channel `Scan List`        | `Scan.csv` _(lossy in #67)_          |
| Zone `Channel Members`     | `Channels.csv` (pipe-separated)      |
| RX group `Contact Members` | `Talkgroups.csv` / `Contacts.csv`    |

## Radio profile

Per-radio limits and wire ladders: [`radios/baofeng-dm32uv.md`](radios/baofeng-dm32uv.md).

## Wire verification

Structural rules enforced by `cps-verify` for profile `dm32-baofeng-dm32uv` ([wire-verification.md](../../build/testing/wire-verification.md)):

| Rule           | Expectation                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| Line endings   | **CRLF** on Studio export CSV                                                                          |
| Quoting        | Selective RFC 4180 (quote fields that contain comma, quote, or newline)                                |
| Headers        | Exact modelled column set + order when the file is present                                             |
| Foreign keys   | Name refs per table above; `ALL` / empty sentinels where documented                                    |
| Cardinality    | RGL members ≤ 32; scan members ≤ 16; channel name ≤ 16 ([baofeng-dm32uv.md](radios/baofeng-dm32uv.md)) |
| Required files | Core set when `Channels.csv` present: Zones, Talkgroups, RXGroupLists, Scan                            |

## Related

- [Data model](../../features/data-model/README.md)
- [Multi-talkgroup expansion](../multi-talkgroup-expansion.md)
- [OpenGD77 reference](../opengd77/README.md) — sibling format
