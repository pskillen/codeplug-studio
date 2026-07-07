# Anytone — per-channel APRS columns

APRS-related columns on `Channel.CSV` (global settings in [aprs.md](aprs.md)).

## Columns

| Vendor header                 | Target mapping (provisional) | Notes                  |
| ----------------------------- | ---------------------------- | ---------------------- |
| `APRS RX`                     | Per-channel APRS RX enable   | `On` / `Off` in sample |
| `Analog APRS PTT Mode`        | Analog APRS PTT behaviour    |                        |
| `Digital APRS PTT Mode`       | Digital APRS PTT behaviour   |                        |
| `APRS Report Type`            | Report type selection        |                        |
| `Digital APRS Report Channel` | Report channel index         |                        |
| `Ana APRS Mute`               | Analog APRS mute flag        |                        |
| `AnaAprsTxPath`               | Analog APRS TX path          |                        |

## Internal model mapping

| Status      | Detail                                                             |
| ----------- | ------------------------------------------------------------------ |
| **Gap**     | No per-channel APRS fields on `Channel` today beyond generic flags |
| **Blocked** | Depends on [aprs.md](aprs.md) `AprsConfiguration` design           |

Until APRS model lands, export adapter may emit fixture defaults for these columns (lossy).

## Related

- [aprs.md](aprs.md)
- [channels.md](channels.md)
