# NeonPlug contacts, radio IDs, and quick contacts

Wire shapes for contact-related arrays in `codeplug.json`.

**Ground truth:**

- [Contact.ts](https://github.com/infamy/NeonPlug/blob/main/src/models/Contact.ts)
- [DMRRadioID.ts](https://github.com/infamy/NeonPlug/blob/main/src/models/DMRRadioID.ts)
- [QuickContact.ts](https://github.com/infamy/NeonPlug/blob/main/src/models/QuickContact.ts)

NeonPlug’s naming does not match Studio’s `TalkGroup` vs `DigitalContact` split one-to-one. Adapters must **classify at the boundary**.

## Contacts (`contacts[]`)

| Field       | Type    | Notes                                              |
| ----------- | ------- | -------------------------------------------------- |
| `id`        | number  | 1–250 (NeonPlug contact book id)                   |
| `name`      | string  | Max 16 chars                                       |
| `dmrId`     | number  | DMR ID / talk-group ID (comments say 7 digits)     |
| `callSign`  | string? | Max 7 chars stored                                 |
| `city` / `province` / `country` / `remark` | string? | Directory metadata              |

Channel `contactId` indexes into the talk-group / TX contact list used by the radio (see NeonPlug Channel comments for blocks 0x42/0x43). Treat `contacts[]` as the human-editable contact book; confirm against a live NeonPlug export whether TX talk groups live here, in `quickContacts`, or both before locking adapter behaviour.

### Studio mapping sketch

| NeonPlug contact          | Likely Studio entity                         |
| ------------------------- | -------------------------------------------- |
| Group / TG-shaped rows    | `TalkGroup`                                  |
| Private call / radio ID   | `DigitalContact`                             |
| `id`                      | Wire index only — UUID on import             |

## DMR radio IDs (`radioIds[]`)

| Field          | Type         | Notes                                         |
| -------------- | ------------ | --------------------------------------------- |
| `index`        | number       | 0-based                                       |
| `dmrId`        | string       | Decimal string e.g. `"1337"`                  |
| `dmrIdValue`   | number       | Numeric                                       |
| `dmrIdBytes`   | `number[]`   | 3-byte little-endian on disk                  |
| `name`         | string       | Null-terminated 12-byte field on radio        |

Channel `dmrRadioIdIndex` references this list (0-based; omit/`255` = none).

### Studio mapping sketch

Studio may only expose a single operator DMR ID today. First NeonPlug export can emit **zero or one** `radioIds` entry from project settings when available; otherwise `[]` with a warning.

## Quick contacts (`quickContacts[]`)

| Field           | Type       | Notes                                                    |
| --------------- | ---------- | -------------------------------------------------------- |
| `index`         | number     | 1-based entry index                                      |
| `offset`        | number     | Byte offset in radio block                               |
| `name`          | string     | ASCII                                                    |
| `contactNumber` | number     | Talk-group / contact number                              |
| `callType`      | number     | `0x03` Private, `0x04` Group, `0x05` All Call            |
| `hasHeader`     | boolean    |                                                          |
| `flag`          | number     | `0x00` PC-created, `0x01` radio-created                  |
| `rawData`       | `number[]` | Raw entry bytes — **do not** use as Studio wire stash    |

### Studio guidance

| Direction | Behaviour                                                                 |
| --------- | ------------------------------------------------------------------------- |
| Export M1 | Prefer `[]` unless a clear library projection exists                      |
| Import    | Map group/private rows into talk groups / digital contacts when possible; drop `rawData` |

Never replay `rawData` on export to pass fidelity tests ([export-from-model](../../../.cursor/rules/export-from-model.mdc)).
