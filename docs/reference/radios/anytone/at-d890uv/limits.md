# AT-D890UV — limits

Provisional caps for variant `anytone-at-d890uv`. Enforced at **export** (warnings / truncation where implemented) — never in library CRUD. The external CPS wire verifier ([#480](https://github.com/pskillen/codeplug-studio/issues/480)) also checks these limits on wire files.

| Constraint                 | Value (provisional)   | Source / notes                                                                                                | Wire verification                           |
| -------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Max channels               | **4000**              | `profiles.ts` — warned on export; not truncated                                                               | Not hard-failed by verifier v1              |
| Max zone members           | **64**                | `profiles.ts` — warned on export                                                                              | `DMRZone.CSV` pipe members ≤ 64             |
| Max scan lists             | **100**               | Verify against CPS manual                                                                                     | Not hard-failed by verifier v1              |
| Max scan list members      | **100**               | Verify against CPS manual                                                                                     | `ScanList.CSV` pipe members ≤ 100           |
| Max RGL members            | **32**                | Hardcoded; not yet warned/truncated on Anytone export                                                         | `DMRReceiveGroupCallList.CSV` contacts ≤ 32 |
| Channel / zone / scan name | **16** chars          | Fixture + `profiles.ts`                                                                                       | Wire names ≤ 16                             |
| Max APRS slots             | **8**                 | `profiles.ts` / [aprs.md](../../../export-formats/anytone/aprs.md)                                            | —                                           |
| VFO row numbers            | `4001` / `4002` (CPS) | CPS appends on import — Studio need not emit ([#357](https://github.com/pskillen/codeplug-studio/issues/357)) | —                                           |

## Related

- [capabilities.md](capabilities.md) · [power.md](power.md)
