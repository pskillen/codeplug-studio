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

## Studio mapping sketch

DM32 CSV in Studio synthesises `Scan.csv` from **zone-derived** scan lists. NeonPlug stores **first-class** scan list objects.

| Approach                       | When                                             |
| ------------------------------ | ------------------------------------------------ |
| Export zone-derived lists      | Match DM32 export philosophy; fill `scanLists[]` |
| Export dedicated library lists | Only if Studio model gains dedicated scan lists  |

Priority / hang-time / CTC modes: **lossy** unless Studio models them — export documented defaults and note in export warnings.

UV5R-Mini typically leaves `scanLists` empty; per-channel `scanAdd` on [channels](channels.md) carries scan intent.
