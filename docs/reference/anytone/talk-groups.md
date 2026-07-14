# Anytone — talk groups and digital contacts

DMR talk groups and private contacts use **separate CPS files** (unlike OpenGD77 single `Contacts.csv`).

## DMRTalkGroups.CSV

Group calls → internal `TalkGroup` with `mode: 'dmr'`.

**Fixture:** [`test-data/anytone/at-d890uv/DMRTalkGroups.CSV`](../../../test-data/anytone/at-d890uv/DMRTalkGroups.CSV)

| Header       | Internal field                      |
| ------------ | ----------------------------------- |
| `No.`        | Export index                        |
| `Radio ID`   | `TalkGroup.digitalId`               |
| `Name`       | `TalkGroup.name` / build `wireName` |
| `Call Type`  | `Group Call` for talk groups        |
| `Call Alert` | Export constant / TBD               |

Referenced from `Channel.CSV` via `Contact/Talk Group` when `Contact/Talk Group Call Type` is `Group Call`.

## DMRDigitalContactList.CSV

Private calls → internal `DigitalContact` with `mode: 'dmr'`.

**Fixture:** [`test-data/anytone/at-d890uv/DMRDigitalContactList.CSV`](../../../test-data/anytone/at-d890uv/DMRDigitalContactList.CSV) (one redacted private-contact row).

| Header       | Internal field                           |
| ------------ | ---------------------------------------- |
| `No.`        | Export index                             |
| `Radio ID`   | `DigitalContact.digitalId`               |
| `Callsign`   | `DigitalContact.callsign` (always from library) |
| `Name`       | Build export name mode + optional per-contact `wireName` override — see below |
| `City`       | `DigitalContact.city`                    |
| `State`      | `DigitalContact.state`                   |
| `Country`    | `DigitalContact.country`                 |
| `Remarks`    | `DigitalContact.remarks`                 |
| `Call Type`  | `Private Call`                           |
| `Call Alert` | Export default `None`                    |

Unmodelled address columns export empty strings when library fields are unset. `Call Alert` remains export constant `None` until CPS enum elicitation ([#297](https://github.com/pskillen/codeplug-studio/issues/297)).

### Observed wire values (operator CPS, July 2026)

| Column             | Observed                  | Studio export  |
| ------------------ | ------------------------- | -------------- |
| `Call Type`        | `Private Call`            | `Private Call` |
| `Call Alert`       | `None`                    | `None`         |
| `Callsign`         | Empty (name-only contact) | `''`           |
| `City` … `Remarks` | Empty                     | `''`           |

Non-`None` **Call Alert** strings still need CPS elicitation — see [enum-verification.md](enum-verification.md).

### Export `Name` composition

Build **Export** and **Contacts** wire pages offer **Contact export name style** (persisted on `exportSettings.digitalContactExportNameMode`):

| Mode            | CPS `Name` source                          |
| --------------- | ------------------------------------------ |
| `name` (default)| Library display `name`                     |
| `callsign`      | Library `callsign`                         |
| `callsign-name` | `"{callsign} {name}"` when both are set    |

Per-contact **wire name overrides** on the build take precedence. Duplicate contact `Name` values are allowed at export — Studio does not disambiguate with numeric suffixes. `Callsign` is always the library callsign column, independent of the name mode.

## Namespace

Talk group and contact **names share a namespace** with channels and lists at the wire edge (case-sensitive). Import adapters must resolve conflicts; internal model keeps separate entity types with UUID ids.

## Related

- [channels.md](channels.md)
- [rx-group-lists.md](rx-group-lists.md)
