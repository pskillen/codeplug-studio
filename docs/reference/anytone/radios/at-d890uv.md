# Anytone AT-D890UV — radio profile

Provisional limits for variant `anytone-at-d890uv`. Calibrated from wire spike [#230](https://github.com/pskillen/codeplug-studio/issues/230); **verify against CPS manual** before enforcing in export adapter ([#233](https://github.com/pskillen/codeplug-studio/issues/233)).

| Property              | Value (provisional) | Source                                                              |
| --------------------- | ------------------- | ------------------------------------------------------------------- |
| `profileId`           | `anytone-at-d890uv` | Epic [#228](https://github.com/pskillen/codeplug-studio/issues/228) |
| Label                 | Anytone AT-D890UV   |                                                                     |
| Max channels          | TBD                 | CPS manual                                                          |
| Max zone members      | TBD                 | Pipe-separated column capacity                                      |
| Max scan list members | TBD                 |                                                                     |
| Max RGL members       | TBD                 |                                                                     |
| Channel name limit    | 16                  | Fixture + `profiles.ts` (verify against CPS manual)                 |
| VFO row numbers       | `4001+` (channels)  | Sample fixture                                                      |

## Power ladder

`Transmit Power` values observed: `Low`, `High`. Map to internal `power` percentage at export boundary — ladder TBD in `profiles.ts` ([#232](https://github.com/pskillen/codeplug-studio/issues/232)).

## Feature availability

| Feature      | CPS files           | Studio v1 export                                                         |
| ------------ | ------------------- | ------------------------------------------------------------------------ |
| DMR channels | `Channel.CSV`, DMR* | Planned ([#233](https://github.com/pskillen/codeplug-studio/issues/233)) |
| Scan lists   | `ScanList.CSV`      | Planned                                                                  |
| AM air       | `AMAir.CSV`         | Channel bank export shipped ([#267](https://github.com/pskillen/codeplug-studio/issues/267)); `AMZone.CSV` wire confirmed, export [#316](https://github.com/pskillen/codeplug-studio/issues/316) |
| Broadcast FM | `FM.CSV`            | Channel bank export shipped ([#268](https://github.com/pskillen/codeplug-studio/issues/268)); `FMZone.CSV` unconfirmed |
| NXDN         | `NX*.CSV`           | Wire documented; export deferred                                         |
| APRS         | `APRS.CSV`          | Blocked on internal model                                                |

## Related

- [README — trait recommendation](../README.md)
- [Feature hub](../../../features/import-export/anytone/README.md)
