# Anytone — per-channel APRS columns

APRS-related columns on `Channel.CSV` (global settings in [aprs.md](aprs.md)).

**Internal model (tier 1):** Field semantics and digital-only scope in [docs/features/aprs/](../../../features/aprs/README.md). Cross-format mapping: [cross-format-reconciliation.md](../../../features/aprs/cross-format-reconciliation.md).

## Columns

| Vendor header                 | Internal field (digital) | Notes                                                            |
| ----------------------------- | ------------------------ | ---------------------------------------------------------------- |
| `APRS RX`                     | `receiveEnabled`         | `On` / `Off` in sample                                           |
| `Digital APRS PTT Mode`       | `digitalPttMode`         | `On` / `Off`                                                     |
| `APRS Report Type`            | `reportType`             | `Off` / `Digital` only in model; wire `Analog` → `off` on import |
| `Digital APRS Report Channel` | `reportChannelRef`       | Resolved to 1-based slot index at export                         |

## Analog columns (export constants only — not modelled)

| Vendor header          | Export constant |
| ---------------------- | --------------- |
| `Analog APRS PTT Mode` | `Off`           |
| `Ana APRS Mute`        | `0`             |
| `AnaAprsTxPath`        | `0`             |

Export adapter ([#251](https://github.com/pskillen/codeplug-studio/issues/251)) emits these regardless of library state.

## Related

- [aprs.md](aprs.md)
- [channels.md](channels.md)
- [docs/features/aprs/](../../../features/aprs/README.md)
