# Anytone — talk groups and digital contacts

The AT-D890UV has two contact stores ([#1433](https://github.com/pskillen/codeplug-studio/issues/1433)): the **Contacts list** (`DMRTalkGroups.CSV`, talk groups and private calls the radio can select) and the **ID database** (`DMRDigitalContactList.CSV`, incoming-call names only). Studio export writes library contacts to **both**.

## DMRTalkGroups.CSV

The radio's Contacts list. Studio export writes:

1. talk groups → `Group Call` rows (internal `TalkGroup` with `mode: 'dmr'`);
2. then the build's library contacts with a DMR ID → `Private Call` rows, with `No.` continuing the sequence, `Name` the contact wire name (the same name `Channel.CSV` and `DMRReceiveGroupCallList.CSV` use for that contact).

Talk groups and contacts share 10,000 rows (`maxTalkGroups`). Contact rows fill only the slots the talk groups leave; the export warns with the number left out. Talk groups past the cap are emitted as before. A contact whose wire name equals a talk group's also warns: the CPS resolves channel and RX-list names against this file.

**Fixture:** [`test-data/anytone/at-d890uv/DMRTalkGroups.CSV`](../../../../test-data/anytone/at-d890uv/DMRTalkGroups.CSV)

| Header       | Internal field                                                 |
| ------------ | -------------------------------------------------------------- |
| `No.`        | Export index                                                   |
| `Radio ID`   | `TalkGroup.digitalId`                                          |
| `Name`       | `TalkGroup.name` / build `wireName`                            |
| `Call Type`  | `Group Call` for talk groups; `Private Call` for contacts      |
| `Call Alert` | Export constant `None` (`Online alert` observed; not modelled) |

Referenced from `Channel.CSV` via `Contact/Talk Group` (`Group Call` or `Private Call`) and from `DMRReceiveGroupCallList.CSV` members. Address columns (`Callsign`, City, …) are not emitted in this file, for contact rows either.

## DMRDigitalContactList.CSV

The radio's ID database (DMR contact DB): names incoming calls; the radio looks here first. Rows follow the Build → Export **ID directory** checkboxes:

- **Include contacts** (default on): the build's library contacts (internal `DigitalContact` with `mode: 'dmr'`);
- **Include ID directory** (default off): ID directory rows after them, skipping any row whose DMR ID is a contact in this build.

Contacts stay in `DMRTalkGroups.CSV` whichever boxes are ticked. A build with only the pre-#1433 single-bank setting reads it once as these boxes (`merge` → both, `directory-only` → directory, `skip` → neither). Directory rows use the directory name as `Name` (they were exported with a blank `Name` before #1433).

**Fixture:** [`test-data/anytone/at-d890uv/DMRDigitalContactList.CSV`](../../../../test-data/anytone/at-d890uv/DMRDigitalContactList.CSV) (one redacted private-contact row).

| Header       | Internal field                                                                |
| ------------ | ----------------------------------------------------------------------------- |
| `No.`        | Export index                                                                  |
| `Radio ID`   | `DigitalContact.digitalId`                                                    |
| `Callsign`   | `DigitalContact.callsign` (always from library)                               |
| `Name`       | Build export name mode + optional per-contact `wireName` override — see below |
| `City`       | `DigitalContact.city`                                                         |
| `State`      | `DigitalContact.state`                                                        |
| `Country`    | `DigitalContact.country`                                                      |
| `Remarks`    | `DigitalContact.remarks`                                                      |
| `Call Type`  | `Private Call`                                                                |
| `Call Alert` | Export default `None` (`None` / `Online alert` confirmed; not modelled)       |

Address columns (`Callsign`, City, State, Country, Remarks) apply to **digital contacts only**. Empty library fields export as empty strings. `Call Alert` stays export constant `None` — not relevant for Studio modelling ([#357](https://github.com/pskillen/codeplug-studio/issues/357)).

### Observed wire values (operator CPS + elicitation, July 2026)

| Column             | Observed                        | Studio export  |
| ------------------ | ------------------------------- | -------------- |
| `Call Type`        | `Private Call`                  | `Private Call` |
| `Call Alert`       | `None`, `Online alert`          | `None`         |
| `Callsign`         | Empty or populated              | Library field  |
| `City` … `Remarks` | Empty or populated address book | Library fields |

### Export `Name` composition

Build **Export** and **Contacts** wire pages offer **Contact export name style** (persisted on `exportSettings.digitalContactExportNameMode`):

| Mode             | CPS `Name` source                       |
| ---------------- | --------------------------------------- |
| `name` (default) | Library display `name`                  |
| `callsign`       | Library `callsign`                      |
| `callsign-name`  | `"{callsign} {name}"` when both are set |

Per-contact **wire name overrides** on the build take precedence. Duplicate contact `Name` values are allowed at export — Studio does not disambiguate with numeric suffixes. `Callsign` is always the library callsign column, independent of the name mode.

## Namespace

Talk group and contact **names share a namespace** with channels and lists at the wire edge (case-sensitive). Import adapters must resolve conflicts; internal model keeps separate entity types with UUID ids.

## Related

- [channels.md](channels.md)
- [rx-group-lists.md](rx-group-lists.md)
