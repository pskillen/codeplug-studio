# NeonPlug RX groups

Wire shape for `codeplug.json` → `rxGroups[]`.

**Ground truth:** [NeonPlug `RXGroup.ts`](https://github.com/infamy/NeonPlug/blob/main/src/models/RXGroup.ts)

## Fields

| Field              | Type       | Notes                                        |
| ------------------ | ---------- | -------------------------------------------- |
| `index`            | number     | 0-based list index                           |
| `name`             | string     | Max **10** chars (11 bytes null-terminated)  |
| `bitmask`          | number     | 32-bit active-groups bitmask (header)        |
| `statusFlag`       | number     | Unused in “new format” per NeonPlug comments |
| `entryFlag`        | number     | Comments: always `0x01`                      |
| `validationFlag`   | number     | Unused in new format                         |
| `talkGroupIndices` | `number[]` | Up to **32** DMR / talk-group numbers        |

## FK rules

- `talkGroupIndices` are **contact / talk-group numbers** from NeonPlug’s talk-group table — not Studio UUIDs.
- Channel `rxGroupListId` points at an RX group list id (`0` = none). Confirm 0-based vs 1-based against a NeonPlug sample before adapter lock-in.

## Studio mapping sketch

| NeonPlug           | Studio                        |
| ------------------ | ----------------------------- |
| RX group row       | `RxGroupList`                 |
| `talkGroupIndices` | UUID talk-group member refs   |
| `bitmask` / flags  | Lossy unless needed for write |

UV5R-Mini / analogue exports: leave `rxGroups` as `[]`.
