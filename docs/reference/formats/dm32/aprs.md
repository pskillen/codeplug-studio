# Baofeng DM32 — APRS

DM-32UV CPS **v1.60 does not import or export an `APRS.csv`**. Global APRS settings are entered in the CPS UI only. Codeplug Studio exports:

1. Per-channel APRS columns on `Channels.csv` from `Channel.aprs`
2. An operator-facing **`APRS.md`** guide (when `Library.aprsConfiguration` is set) with suggested CPS values

**Tracking:** [#250](https://github.com/pskillen/codeplug-studio/issues/250) · Epic [#246](https://github.com/pskillen/codeplug-studio/issues/246)

**Internal model:** [docs/features/aprs/](../../../features/aprs/README.md) · Cross-format: [cross-format-reconciliation.md](../../../features/aprs/cross-format-reconciliation.md)

## Channel columns (`Channels.csv`)

| Vendor header           | Internal field                 | Export wire                                                                              |
| ----------------------- | ------------------------------ | ---------------------------------------------------------------------------------------- |
| `APRS Report Type`      | `Channel.aprs.reportType`      | `Off` / `Digital` (analog channels may still use digital reporting)                      |
| `APRS Receive`          | `Channel.aprs.receiveEnabled`  | `0` / `1`                                                                                |
| `Analog APRS PTT Mode`  | —                              | **Constant** `0` (no analog APRS hardware)                                               |
| `Digital APRS PTT Mode` | `Channel.aprs.digitalPttMode`  | `0` / `1`                                                                                |
| `APRS Report Channel`   | `Channel.aprs.reportSlotIndex` | When `reportType === digital`: slot index or `1`; else analog row `256`, digital row `1` |

Omit `Channel.aprs` → Off / `0` / off-placeholder as above.

## Global guide (`APRS.md`)

Included in the export ZIP when `assembled.aprsConfiguration` is non-null. Not consumed by CPS — checklist for the operator.

| CPS UI field        | Studio source                                                                      |
| ------------------- | ---------------------------------------------------------------------------------- |
| Scheduled send time | Lists both `manualTxIntervalSec` and `autoTxIntervalSec` (CPS may use one control) |
| Call type           | First contributing slot’s `callType` (`Private` / `Group`)                         |
| Upload number       | First contributing slot’s `targetDmrId`                                            |
| Report channels 1–8 | Slot `channelRef` → export wire name, or `Current Channel` when null               |

**Loss:** CPS supports a single call type + upload number for all report channels. When slots disagree, export warns and `APRS.md` uses slot 1’s values.

## Related

- [channels.md](channels.md)
- Code: `src/core/import-export/formats/dm32/aprsWireFormat.ts`, `aprsGuide.ts`
