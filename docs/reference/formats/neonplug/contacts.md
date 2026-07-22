# NeonPlug contacts, radio IDs, and quick contacts

Wire shapes for contact-related arrays in `codeplug.json`.

**Ground truth:**

- [Contact.ts](https://github.com/infamy/NeonPlug/blob/main/src/models/Contact.ts)
- [DMRRadioID.ts](https://github.com/infamy/NeonPlug/blob/main/src/models/DMRRadioID.ts)
- [QuickContact.ts](https://github.com/infamy/NeonPlug/blob/main/src/models/QuickContact.ts)

NeonPlug’s naming does not match Studio’s `TalkGroup` vs `DigitalContact` split one-to-one. Adapters **classify at the boundary**.

## Contacts (`contacts[]`)

| Field                                      | Type    | Notes                                          |
| ------------------------------------------ | ------- | ---------------------------------------------- |
| `id`                                       | number  | 1–250 (NeonPlug contact book id)               |
| `name`                                     | string  | Max 16 chars                                   |
| `dmrId`                                    | number  | DMR ID / talk-group ID (comments say 7 digits) |
| `callSign`                                 | string? | Max 7 chars stored                             |
| `city` / `province` / `country` / `remark` | string? | Directory metadata                             |

Channel `contactId` indexes this book (`0` = none, `1+` = `contacts[].id`). NeonPlug radio comments call this the talk-group list (block 0x44); the JSON interchange exposes a single `contacts[]` array.

### Studio export mapping (shipped #540)

| Order | Studio entity    | NeonPlug contact fields                                    |
| ----- | ---------------- | ---------------------------------------------------------- |
| 1…    | `TalkGroup`      | `name`, `dmrId` = `digitalId`                              |
| then  | `DigitalContact` | `name`, `dmrId`, optional `callSign` / city / province / … |

- Cap at profile `maxContacts` (250) with export warning.
- Analog / DTMF contacts omitted.
- Channel `contactRef` → `contactId` via entity UUID map.

## DMR radio IDs (`radioIds[]`)

| Field        | Type       | Notes                                  |
| ------------ | ---------- | -------------------------------------- |
| `index`      | number     | 0-based                                |
| `dmrId`      | string     | Decimal string e.g. `"1337"`           |
| `dmrIdValue` | number     | Numeric                                |
| `dmrIdBytes` | `number[]` | 3-byte little-endian on disk           |
| `name`       | string     | Null-terminated 12-byte field on radio |

Channel `dmrRadioIdIndex` references this list (0-based; omit/`255` = none).

### Studio export mapping (shipped #540)

Studio has no first-class operator DMR-ID list. Export emits **`radioIds: []`** and leaves `dmrRadioIdIndex` at none (`0`). Documented omit — not a warning spam.

## Quick contacts (`quickContacts[]`)

| Field           | Type       | Notes                                                 |
| --------------- | ---------- | ----------------------------------------------------- |
| `index`         | number     | 1-based entry index                                   |
| `offset`        | number     | Byte offset in the block where this entry starts      |
| `name`          | string     | ASCII                                                 |
| `contactNumber` | number     | Talk-group / contact number                           |
| `callType`      | number     | `0x03` Private, `0x04` Group, `0x05` All Call         |
| `hasHeader`     | boolean    |                                                       |
| `flag`          | number     | `0x00` PC-created, `0x01` radio-created               |
| `rawData`       | `number[]` | Raw entry bytes — **do not** use as Studio wire stash |

### Studio guidance

| Direction | Behaviour                                                                                |
| --------- | ---------------------------------------------------------------------------------------- |
| Export M1 | Prefer `[]` unless a clear library projection exists                                     |
| Import    | Map group/private rows into talk groups / digital contacts when possible; drop `rawData` |

Never replay `rawData` on export to pass fidelity tests ([export-from-model](../../../.cursor/rules/export-from-model.mdc)).
