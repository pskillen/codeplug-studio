# AT-D890UV — limits

Provisional caps for variant `anytone-at-d890uv`. Enforced at **export** (warnings / truncation where implemented) — never in library CRUD. The external CPS wire verifier ([#480](https://github.com/pskillen/codeplug-studio/issues/480)) also checks these limits on wire files.

**Code:** `src/core/radios/anytone/at-d890uv/limits.ts` (`AT_D890UV_LIMITS`); profiles in `formats/anytone/profiles.ts` and `formats/radio-io/profiles.ts` import the same facts.

| Constraint                 | Value (provisional)   | Source / notes                                                                                                    | Wire verification                           |
| -------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Max channels               | **4000**              | `AT_D890UV_LIMITS.CHANNEL_MAX` — warned on export; not truncated                                                  | Not hard-failed by verifier v1              |
| Max zones                  | **256**               | `AT_D890UV_LIMITS.ZONE_MAX`                                                                                       | —                                           |
| Max zone members           | **64**                | `AT_D890UV_LIMITS.ZONE_MEMBERS_MAX` — warned on export                                                            | `DMRZone.CSV` pipe members ≤ 64             |
| Max scan lists             | **100**               | `AT_D890UV_LIMITS.SCAN_LISTS_MAX`                                                                                 | Not hard-failed by verifier v1              |
| Max scan list members      | **50**                | `AT_D890UV_LIMITS.SCAN_LIST_MEMBERS_MAX` — binary record holds 50 × u16 at `+0x30` (`ScanListData` stride `0xd0`) | `ScanList.CSV` pipe members ≤ 50            |
| Max RX group lists         | **128**               | `AT_D890UV_LIMITS.RX_GROUP_LISTS_MAX`                                                                             | —                                           |
| Max RGL members            | **32**                | `AT_D890UV_LIMITS.RX_GROUP_MEMBERS_MAX` — not yet warned/truncated on Anytone export (M6)                         | `DMRReceiveGroupCallList.CSV` contacts ≤ 32 |
| Max talk groups            | **10000**             | `AT_D890UV_LIMITS.TALK_GROUPS_MAX` — Web Serial projection                                                        | —                                           |
| Channel / zone / scan name | **16** chars          | Fixture + `profiles.ts`                                                                                           | Wire names ≤ 16                             |
| Max APRS slots             | **8**                 | `profiles.ts` / [aprs.md](../../../export-formats/anytone/aprs.md)                                                | —                                           |
| Max AM airband channels    | **256**               | `AT_D890UV_LIMITS.AM_AIR_CHANNEL_MAX` — parallel AmAir bank                                                       | `AMAir.CSV` programmed rows ≤ 256           |
| Max AM airband zones       | **16**                | `AT_D890UV_LIMITS.AM_ZONE_MAX`                                                                                    | `AMZone.CSV` rows ≤ 16                      |
| Max AM zone members        | **32**                | `AT_D890UV_LIMITS.AM_ZONE_MEMBERS_MAX` — narrower than DMR zones                                                  | `AMZone.CSV` pipe members ≤ 32              |
| VFO row numbers            | `4001` / `4002` (CPS) | CPS appends on import — Studio need not emit ([#357](https://github.com/pskillen/codeplug-studio/issues/357))     | —                                           |

## Related

- [capabilities.md](capabilities.md) · [power.md](power.md)
