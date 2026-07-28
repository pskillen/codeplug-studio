# UV-5R Mini — limits

Shared hardware / memory caps. Adapters warn or truncate at the **export / write boundary** — library CRUD stays unlimited.

| Constraint                                             | Value        | Notes                                                                                                                                                           |
| ------------------------------------------------------ | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Max memory slots / channels                            | **999**      | CHIRP `CHANNELS=999`; NeonPlug `BAOFENG_CHANNEL_COUNT`                                                                                                          |
| Channel name                                           | **12** chars | Name shortening at export boundary                                                                                                                              |
| Zone / scan-list / contact / TG / RX-list organisation | N/A          | Flat-memory radio — those entities unused                                                                                                                       |
| Default scan inclusion (export)                        | **skip**     | When library `scanInclusion` is `default`; radio SoT `UV5R_MINI_LIMITS.DEFAULT_SCAN_INCLUSION` ([#806](https://github.com/pskillen/codeplug-studio/issues/806)) |

Re-verified against CHIRP after UV-5R Mini cap fix ([#584](https://github.com/pskillen/codeplug-studio/issues/584) / [#602](https://github.com/pskillen/codeplug-studio/issues/602)).

**Code:** `src/core/radios/baofeng/uv-5r-mini/limits.ts`

## Adapter application

| Adapter                      | Behaviour when over limit                                                 |
| ---------------------------- | ------------------------------------------------------------------------- |
| CHIRP `chirp-uv5r`           | Warn; truncate lowest-priority rows if forced; `cps-verify` enforces caps |
| NeonPlug `neonplug-uv5rmini` | Export warnings from Studio profile constants                             |

See [capabilities.md](capabilities.md) for mode skip rules.
