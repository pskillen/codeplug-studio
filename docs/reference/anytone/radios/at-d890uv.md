# Anytone AT-D890UV — radio profile

Provisional limits for variant `anytone-at-d890uv`. Calibrated from wire spike [#230](https://github.com/pskillen/codeplug-studio/issues/230); **verify against CPS manual** before enforcing in export adapter ([#233](https://github.com/pskillen/codeplug-studio/issues/233)).

| Property              | Value (provisional) | Source                                                              |
| --------------------- | ------------------- | ------------------------------------------------------------------- |
| `profileId`           | `anytone-at-d890uv` | Epic [#228](https://github.com/pskillen/codeplug-studio/issues/228) |
| Label                 | Anytone AT-D890UV   |                                                                     |
| Max channels          | TBD                 | CPS manual                                                          |
| Max zone members      | TBD                 | Pipe-separated column capacity                                      |
| Max scan lists        | 100 (provisional)   | `profiles.ts` — verify against CPS manual                           |
| Max scan list members | 100 (provisional)   | `profiles.ts` — verify against CPS manual                           |
| Max RGL members       | TBD                 |                                                                     |
| Channel name limit    | 16                  | Fixture + `profiles.ts` (verify against CPS manual)                 |
| VFO row numbers       | `4001`/`4002` (CPS) | CPS appends on import — Studio need not emit ([#357](https://github.com/pskillen/codeplug-studio/issues/357)) |

## Power ladder

Confirmed AT-D890UV `Transmit Power` wire values and approximate output ([#357](https://github.com/pskillen/codeplug-studio/issues/357)):

| Wire    | Approx. power                         |
| ------- | ------------------------------------- |
| `Low`   | 0.2 W                                 |
| `Mid`   | 2.5 W                                 |
| `High`  | 5 W                                   |
| `Turbo` | 7 W VHF / 6 W UHF                     |

Map to internal `power` percentage at the export boundary in `profiles.ts`. Studio today only ladders `Low` / `High` — Mid/Turbo follow-up under Phase 7 export ([#228](https://github.com/pskillen/codeplug-studio/issues/228)).

## Feature availability

| Feature      | CPS files           | Studio v1 export                                                                                                                                                                           |
| ------------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| DMR channels | `Channel.CSV`, DMR* | Shipped ([#233](https://github.com/pskillen/codeplug-studio/issues/233))                                                                                                                   |
| Scan lists   | `ScanList.CSV`      | Shipped                                                                                                                                                                                    |
| AM air       | `AMAir.CSV`         | Channel bank export shipped ([#267](https://github.com/pskillen/codeplug-studio/issues/267)); `AMZone.CSV` export shipped ([#316](https://github.com/pskillen/codeplug-studio/issues/316)) |
| Broadcast FM | `FM.CSV`            | Channel bank export shipped ([#268](https://github.com/pskillen/codeplug-studio/issues/268)); **no `FMZone.CSV` on D890**                                                                  |
| NXDN         | `NX*.CSV`           | Wire documented; export deferred ([#247](https://github.com/pskillen/codeplug-studio/issues/247))                                                                                          |
| APRS         | `APRS.CSV`          | Shipped — conditional when `library.aprsConfiguration` exists ([#251](https://github.com/pskillen/codeplug-studio/issues/251))                                                             |

## Related

- [README — trait recommendation](../README.md)
- [Feature hub](../../../features/import-export/anytone/README.md)
