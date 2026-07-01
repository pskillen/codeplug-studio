# Baofeng DM32 CPS CSV reference

> **Studio status:** Wire reference ported from [codeplug-tool](https://github.com/pskillen/codeplug-tool); DM32 import/export adapters ship Phase 4–6 under `src/core/import-export/formats/dm32/`.

Authoritative reference for **Baofeng DM-32UV stock CPS** CSV exports (v1.60+). One wire format among several at the import/export boundary.

**Tracking:** archive reference (codeplug-tool#67)

## File inventory (v1.60)

| File | Reference | #67 import | #67 export | Modelled |
| --- | --- | --- | --- | --- |
| `Channels.csv` | [channels.md](channels.md) | Yes | Yes | `Channel[]` (`multiMode` / `modeProfiles`) |
| `Zones.csv` | [zones.md](zones.md) | Yes | Yes | Build **zone grouping** trait layout |
| `Talkgroups.csv` | [talkgroups.md](talkgroups.md) | Yes | Yes | `TalkGroup[]` |
| `Contacts.csv` | [contacts.md](contacts.md) | Yes | Yes | `Contact[]` (`signalingMode: dmr`) |
| `RXGroupLists.csv` | [rx-group-lists.md](rx-group-lists.md) | Yes | Yes | `RxGroupList[]` |
| `DTMFContacts.csv` | [dtmf-contacts.md](dtmf-contacts.md) | Yes | Yes | `Contact[]` (`signalingMode: dtmf`) |
| `Scan.csv` | [scan-lists.md](scan-lists.md) | **Skip** | **Skip** | Deferred — archive reference #125 |
| `DMR-ID.csv` | — | **Skip** | **Skip** | Accepted gap |

Committed fixture: [`test-data/baofeng-dm32/v1.60/`](../../../test-data/baofeng-dm32/v1.60/).

## Filename quirks

- v1.60 CPS uses **PascalCase** (`Channels.csv`, `Scan.csv`).
- Operator-repo exports may use lowercase (`channels.csv`, `scanlist.csv`).
- Some CPS builds save `channels.csv.csv` — rename to `channels.csv` before import.

## Foreign keys (name-based at wire edge)

| Column | Target file |
| --- | --- |
| Channel `TX Contact` | `Talkgroups.csv` or `Contacts.csv` |
| Channel `RX Group List` | `RXGroupLists.csv` or sentinel `ALL` |
| Channel `Scan List` | `Scan.csv` _(lossy in #67)_ |
| Zone `Channel Members` | `Channels.csv` (pipe-separated) |
| RX group `Contact Members` | `Talkgroups.csv` / `Contacts.csv` |

## Radio profile

Per-radio limits and wire ladders: [`radios/baofeng-dm32uv.md`](radios/baofeng-dm32uv.md).

## Related

- [Data model](../../features/data-model/README.md)
- [Multi-talkgroup expansion](../multi-talkgroup-expansion.md)
- [OpenGD77 reference](../opengd77/README.md) — sibling format
