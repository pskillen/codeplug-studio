# NeonPlug scan lists

Wire shape for `codeplug.json` → `scanLists[]`.

**Ground truth:** [NeonPlug `ScanList.ts`](https://github.com/infamy/NeonPlug/blob/main/src/models/ScanList.ts)

## Fields

| Field                 | Type       | Notes                                           |
| --------------------- | ---------- | ----------------------------------------------- |
| `name`                | string     | Max **10** chars (11 bytes with null on radio)  |
| `channels`            | `number[]` | Up to **15** channel numbers                    |
| `channelCount`        | number?    | Optional; NeonPlug may auto-calculate           |
| `ctcScanMode`         | number     | 0–3                                             |
| `scanTxMode`          | number     | 0–2                                             |
| `hangTime`            | number?    | Tenths of seconds (1–255)                       |
| `priority1Type`       | number?    | 0=None, 1=Current, 2=Specific                   |
| `priority2Type`       | number?    | same                                            |
| `priorityChannel1`    | number?    | Channel id 1–999                                |
| `priorityChannel2`    | number?    | Encoded with −2 convention in NeonPlug comments |
| `designatedTxChannel` | number?    | Encoded with −2 convention                      |

## FK rules

- Member channels are **numbers** into `channels[]`.
- Priority / designated TX channel fields also use channel numbers (with NeonPlug encoding quirks for “None” / “Current”).
- Channel `scanListId`: `0` = none; else **1-based** index into `scanLists[]`. Channel wire field is 4 bits (0–15), so at most **15** referenceable lists.

## Studio export mapping (shipped #540)

DM32 CSV synthesises `Scan.csv` from **zone-derived** scan lists (with synthetic carriers). NeonPlug stores **first-class** scan list objects.

| Behaviour             | Studio export                                               |
| --------------------- | ----------------------------------------------------------- |
| Source                | Zone grouping `exportScanList` + scan membership helpers    |
| Members               | Channel **numbers** (no m×n expansion on this profile)      |
| Synthetic carriers    | **Not emitted** (DM32 CSV quirk only)                       |
| Priority / hang / CTC | Lossy defaults: `ctcScanMode`/`scanTxMode` = `0`; omit rest |
| Cap                   | Min of profile `maxScanLists` and **15**                    |

UV5R-Mini leaves `scanLists` empty; per-channel `scanAdd` on [channels](channels.md) carries scan intent.
