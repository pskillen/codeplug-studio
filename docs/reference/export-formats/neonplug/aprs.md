# NeonPlug APRS (DM-32UV)

Wire mapping for digital APRS on NeonPlug **DM-32UV / DP570UV** interchange.

**Tracking:** [#559](https://github.com/pskillen/codeplug-studio/issues/559) · Epic [#536](https://github.com/pskillen/codeplug-studio/issues/536)

**Ground truth:** [NeonPlug `RadioSettings.ts`](https://github.com/infamy/NeonPlug/blob/main/src/models/RadioSettings.ts) · [Channel.ts](https://github.com/infamy/NeonPlug/blob/main/src/models/Channel.ts) · binary offsets in `src/radios/dm32uv/structures.ts`

**Internal model:** [docs/features/aprs/](../../../features/aprs/README.md) · Cross-format: [cross-format-reconciliation.md](../../../features/aprs/cross-format-reconciliation.md)

**Code:** `src/core/import-export/formats/neonplug/aprsSettingsWire.ts`, `channelWire.ts`, merge via `exportBuildZip`

Studio does **not** invent a Baofeng `APRS.csv`. NeonPlug is the programmable globals path for DM-32UV; DM32 CPS CSV still emits operator-facing [`APRS.md`](../dm32/aprs.md).

## Per-channel (`channels[]`)

| NeonPlug field   | Type / enum                      | Studio source                 | Notes                                                                |
| ---------------- | -------------------------------- | ----------------------------- | -------------------------------------------------------------------- |
| `aprsReceive`    | boolean                          | `Channel.aprs.receiveEnabled` | Default `false` when binding absent                                  |
| `aprsReportMode` | `'Off' \| 'Digital' \| 'Analog'` | `Channel.aprs.reportType`     | Studio digital-only model → `'Digital'` or `'Off'`; never `'Analog'` |

NeonPlug `Channel` has **no** digital-PTT or report-slot-index fields. Those bind via `radioSettings` report channels 1–8 (below). `Channel.aprs.digitalPttMode` and `reportSlotIndex` are unused on this pathway.

## Globals (`radioSettings` APRS slice)

Applied on **merge-into-base** as a shallow leaf patch over the retained donor bag. **Greenfield** leaves `radioSettings: null` and warns that APRS globals require merge.

| NeonPlug field                            | Encoding                                          | Studio source                                                                                               |
| ----------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `aprsReportChannel1`…`aprsReportChannel8` | uint channel **number**; `0` = current channel    | `AprsConfiguration.channelSlots[i].channelRef` → first expanded export number; missing → `0` + warn         |
| `aprsScheduledSendTime`                   | Combo idx: `0`=Off, `n`=`n×30s` (max 240 → 7200s) | Prefer `autoTxIntervalSec`, else `manualTxIntervalSec`; `round(s/30)` clamp 1…240; warn if both snap differ |
| `aprsFixedBeacon`                         | boolean                                           | `positionSource === 'fixed'`                                                                                |
| `latitude` / `latitudeDirection`          | ≤9-char ASCII abs degrees + `'N'\|'S'`            | `fixedLocation` when fixed                                                                                  |
| `longitude` / `longitudeDirection`        | ≤9-char ASCII abs degrees + `'E'\|'W'`            | `fixedLocation` when fixed                                                                                  |
| `aprsCallType`                            | boolean (`false`=Private, `true`=Group)           | First **contributing** slot’s `callType` (same consensus as DM32 `APRS.md`)                                 |
| `aprsUploadId`                            | 24-bit DMR ID; `0` = unset                        | First contributing slot’s `targetDmrId`                                                                     |
| `gpsEnabled`                              | boolean (optional patch)                          | Set `true` for GNSS position sources                                                                        |
| `gpsMode`                                 | `0`=GPS, `1`=BDS, `2`=GPS+BDS                     | `gps` / `beidou` / `allGnss` (and `galileo` → `2` + warn)                                                   |

### Unmodelled (retain donor)

| Field                     | Notes                                       |
| ------------------------- | ------------------------------------------- |
| `aprsRepeaterActiveDelay` | Not in library APRS model — leave donor     |
| Other GPS / menu / VFO    | Outside APRS slice — retain entire bag keys |

## Export paths

| Path                | Behaviour                                                                                           |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| **Merge-into-base** | Donor `radioSettings` retained, then APRS (+ GPS mode/enable/coords) leaves overwritten from Studio |
| **Greenfield**      | `radioSettings: null`; warning when `Library.aprsConfiguration` is set                              |

## Documented loss

| Item                                    | Reason                                                                              |
| --------------------------------------- | ----------------------------------------------------------------------------------- |
| Per-slot call type / upload ID          | NeonPlug has one global; export uses first contributing slot + warn on disagreement |
| Manual vs auto interval                 | NeonPlug has one scheduled-send control; prefer auto, snap to 30s steps             |
| Slot `timeslot`                         | Not present on NeonPlug radioSettings APRS fields                                   |
| Channel digital PTT / report slot index | Not on NeonPlug Channel — settings slots only                                       |
| Analog APRS report mode                 | Studio model is digital-only                                                        |
| Greenfield APRS globals                 | Omitted — merge required for radio write                                            |
| `aprsRepeaterActiveDelay`               | Unmodelled                                                                          |
| NeonPlug → library **import** of APRS   | Deferred (follow-up under import epic)                                              |

## Related

- [channels.md](channels.md) — channel APRS pair
- [merge.md](merge.md) — merge policy including APRS patch
- [radio-info-and-settings.md](radio-info-and-settings.md)
- Sibling CPS path: [dm32/aprs.md](../dm32/aprs.md)
