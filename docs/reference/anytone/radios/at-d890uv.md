# Anytone AT-D890UV — radio profile

Provisional limits for variant `anytone-at-d890uv`. Values mirror `profiles.ts` (`ANYTONE_PROFILES`); still verify against CPS manual before treating as hard radio caps. Caps are enforced at **export** (warnings / truncation where implemented) — never in library CRUD. The external CPS wire verifier ([#480](https://github.com/pskillen/codeplug-studio/issues/480)) also checks these limits on wire files.

| Property              | Value (provisional) | Source                                                                                                        | Wire verification                           |
| --------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `profileId`           | `anytone-at-d890uv` | Epic [#228](https://github.com/pskillen/codeplug-studio/issues/228)                                           | —                                           |
| Label                 | Anytone AT-D890UV   |                                                                                                               | —                                           |
| Max channels          | 4000                | `profiles.ts` — warned on export; not truncated                                                               | Not hard-failed by verifier v1              |
| Max zone members      | 64                  | `profiles.ts` — warned on export                                                                              | `DMRZone.CSV` pipe members ≤ 64             |
| Max scan lists        | 100                 | `profiles.ts` — verify against CPS manual                                                                     | Not hard-failed by verifier v1              |
| Max scan list members | 100                 | `profiles.ts` — verify against CPS manual                                                                     | `ScanList.CSV` pipe members ≤ 100           |
| Max RGL members       | 32                  | `profiles.ts` — hardcoded; not yet warned/truncated on Anytone export                                         | `DMRReceiveGroupCallList.CSV` contacts ≤ 32 |
| Channel name limit    | 16                  | Fixture + `profiles.ts` (verify against CPS manual)                                                           | Channel / zone / scan wire names ≤ 16       |
| Max APRS slots        | 8                   | `profiles.ts` / [aprs.md](../aprs.md)                                                                         | —                                           |
| VFO row numbers       | `4001`/`4002` (CPS) | CPS appends on import — Studio need not emit ([#357](https://github.com/pskillen/codeplug-studio/issues/357)) | —                                           |

## Transmit Power

Confirmed AT-D890UV `Transmit Power` wire values and approximate output ([#357](https://github.com/pskillen/codeplug-studio/issues/357)):

| Wire    | Approx. power     | Studio `%` (nearest) |
| ------- | ----------------- | -------------------- |
| `Low`   | 0.2 W             | 25                   |
| `Mid`   | 2.5 W             | 50                   |
| `High`  | 5 W               | 75                   |
| `Turbo` | 7 W VHF / 6 W UHF | 100                  |

Map at the export boundary in `profiles.ts` (`AT_D890UV_POWER_LADDER`). Watts are informational; `%` steps are discrete UI/export buckets (not exact watt ratios). `null` power → `Turbo`. Ladder order keeps **Turbo first** so the null default is Turbo.

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
- Code ↔ docs mop-up: [#402](https://github.com/pskillen/codeplug-studio/issues/402)
