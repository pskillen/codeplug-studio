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

**Fixture:** header-only in committed bundle (operator sample had no body rows).

| Header             | Internal field             |
| ------------------ | -------------------------- |
| `No.`              | Export index               |
| `Radio ID`         | `DigitalContact.digitalId` |
| `Callsign`         | Optional wire label        |
| `Name`             | `DigitalContact.name`      |
| `City`             | Export default `''` (unmodelled) |
| `State`            | Export default `''`              |
| `Country`          | Export default `''`              |
| `Remarks`          | Export default `''`              |
| `Call Type`        | `Private Call`                   |
| `Call Alert`       | Export default `None`              |

Unmodelled address columns export empty strings until library CRUD gains contact metadata ([#297](https://github.com/pskillen/codeplug-studio/issues/297)). `Call Alert` enum values need CPS elicitation — see [enum-verification.md](enum-verification.md).

## Namespace

Talk group and contact **names share a namespace** with channels and lists at the wire edge (case-sensitive). Import adapters must resolve conflicts; internal model keeps separate entity types with UUID ids.

## Related

- [channels.md](channels.md)
- [rx-group-lists.md](rx-group-lists.md)
