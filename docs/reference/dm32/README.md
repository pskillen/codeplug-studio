# Baofeng DM32 CPS CSV reference

> **Studio status:** DM32 CPS CSV **export** ships under `src/core/import-export/formats/dm32/`. For **writing the radio**, prefer [NeonPlug DM32UV](../neonplug/radios/dm32uv.md) (`.neonplug`) — stock Baofeng CPS import/round-trip is unreliable. See [cps-csv-gaps.md](../../features/import-export/dm32/cps-csv-gaps.md).

Authoritative reference for **Baofeng DM-32UV stock CPS** CSV exports (v1.60+). One wire format among several at the import/export boundary.

**Tracking:** archive reference (codeplug-tool#67) · product epic [#503](https://github.com/pskillen/codeplug-studio/issues/503)

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

**Canonical CPS sample (unadulterated):** [`sample-codeplugs/baofeng-dm32/1.60/`](../../../sample-codeplugs/baofeng-dm32/1.60/) — working v1.60 codeplug for wire elicitation ([#404](https://github.com/pskillen/codeplug-studio/issues/404)). Prefer this over fixture trees when checking CPS-truth column headers and cell values.

**Test fixture (may be trimmed / renamed for tests):** [`test-data/baofeng-dm32/v1.60/`](../../../test-data/baofeng-dm32/v1.60/).

## Wire elicitation

Human-led CPS v1.60 column/enum elicitation (supersedes [#356](https://github.com/pskillen/codeplug-studio/issues/356)): [#404](https://github.com/pskillen/codeplug-studio/issues/404) · worksheet [enum-verification.md](enum-verification.md) (**parked** — NeonPlug preferred for radio write).

Convertible backlog + NeonPlug learnings: [cps-csv-gaps.md](../../features/import-export/dm32/cps-csv-gaps.md).

Tier-3 docs drift vs shipped export was fixed in [#444](https://github.com/pskillen/codeplug-studio/issues/444) / PR [#453](https://github.com/pskillen/codeplug-studio/pull/453).

## Line endings

| Property     | Value                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------ |
| Line endings | **CRLF** on Studio export for all DM32 CSV files; normalise to LF in tests when comparing committed fixtures |

Official Baofeng DM-32UV CPS exports use Windows (CRLF) line endings. Studio DM32 export matches ([#314](https://github.com/pskillen/codeplug-studio/issues/314)). Import parsing accepts both LF and CRLF.

## Filenames

DM-32UV CPS import/export is **manual, per file**, with **no fixed default filenames** — the operator picks paths when saving or loading each CSV. Filename spelling drift between a given CPS save dialog, Studio ZIP members, docs, and `test-data/` is therefore **inconsequential** as long as names stay clear (e.g. channels vs zones vs talk groups). Wire truth is **headers and cell values**, not the on-disk basename.

Example names from the [canonical sample](../../../sample-codeplugs/baofeng-dm32/1.60/) (one operator’s CPS save choices): `Channels.csv`, `Zones.csv`, `TalkGroups.csv`, `DigitalContacts.csv`, `AnalogContacts.csv`, `RxGroupLists.csv`, `ScanList.csv`, `DMR-ID.csv`. Studio docs and export often use close variants (`Talkgroups.csv`, `Contacts.csv`, `DTMFContacts.csv`, `RXGroupLists.csv`, `Scan.csv`) — treat them as labels for the same file roles.

Also:

- Operator-repo exports may use lowercase (`channels.csv`, `scanlist.csv`).
- Some CPS builds save `channels.csv.csv` — rename before import if needed.

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

| Rule           | Expectation                                                                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Line endings   | **CRLF** on Studio export CSV                                                                                                                                                  |
| Quoting        | Selective RFC 4180 (quote fields that contain comma, quote, or newline)                                                                                                        |
| Headers        | Exact modelled column set + order when the file is present                                                                                                                     |
| Foreign keys   | Name refs per table above; `ALL` / empty sentinels where documented                                                                                                            |
| Cardinality    | Channels ≤ 4000; zone members ≤ 64; RGL members ≤ 32; scan members ≤ 15; channel/zone name ≤ 16; Scan Name ≤ 10; RGL name ≤ 10 ([baofeng-dm32uv.md](radios/baofeng-dm32uv.md)) |
| Required files | Core set when `Channels.csv` present: Zones, Talkgroups, RXGroupLists, Scan                                                                                                    |

## Related

- [Data model](../../features/data-model/README.md)
- [Multi-talkgroup expansion](../multi-talkgroup-expansion.md)
- [cps-csv-gaps.md](../../features/import-export/dm32/cps-csv-gaps.md) — parked CPS fidelity backlog + NeonPlug learnings
- [enum-verification.md](enum-verification.md) — partial CPS elicitation worksheet ([#404](https://github.com/pskillen/codeplug-studio/issues/404); parked)
- [NeonPlug DM-32UV](../neonplug/radios/dm32uv.md) — preferred radio-write sibling
- [OpenGD77 reference](../opengd77/README.md) — sibling format
