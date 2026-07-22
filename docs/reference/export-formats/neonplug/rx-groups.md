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
| `talkGroupIndices` | `number[]` | Up to **32** DMR / talk-group **DMR IDs**    |

## FK rules

- `talkGroupIndices` are **DMR IDs** (`TalkGroup.digitalId`) as stored on the radio — not Studio UUIDs and not contacts-book indexes (NeonPlug `structures.ts`).
- Channel `rxGroupListId`: `0` = none; else **1-based** position in emitted `rxGroups[]` (`rxGroups[i].index = i`).

## Studio export mapping (shipped #540)

| NeonPlug           | Studio                               |
| ------------------ | ------------------------------------ |
| RX group row       | `RxGroupList`                        |
| `talkGroupIndices` | Member talk-group `digitalId` values |
| `bitmask` / flags  | `entryFlag: 1`; others `0` (lossy)   |

UV5R-Mini / analogue exports: leave `rxGroups` as `[]`.
