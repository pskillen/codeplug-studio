# DM-32UV — limits

Shared hardware / memory caps (NeonPlug `LIMITS` + radio-confirmed zone name length). Adapters warn or truncate at the **export boundary** — library CRUD stays unlimited.

| Constraint                          | Value    | Notes                                                                                                                          |
| ----------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Channels                            | **4000** |                                                                                                                                |
| Zones                               | **250**  |                                                                                                                                |
| Zone members                        | **64**   | Distinct from scan-list member cap                                                                                             |
| Scan lists                          | **32**   |                                                                                                                                |
| Scan list members                   | **15**   | Named CSV members; CPS “16” includes implicit current channel ([#486](https://github.com/pskillen/codeplug-studio/issues/486)) |
| RX group lists                      | **32**   |                                                                                                                                |
| RX group list members               | **32**   |                                                                                                                                |
| Contacts                            | **250**  |                                                                                                                                |
| Talk groups                         | **800**  |                                                                                                                                |
| Channel / zone / contact / TG names | **16**   | `nameLimit` — channel LCD + radio-confirmed zone                                                                               |
| Scan list names                     | **10**   | `scanListNameLimit` — conservative (CPS official 11; NeonPlug field 10)                                                        |
| RX group list names                 | **10**   | `rxGroupListNameLimit` — NeonPlug RXGroup 11-byte null-terminated field                                                        |

Zone-derived scan lists synthesise at most **15** named members even when a zone has up to **64** members — intentional export loss; see DM32 [scan-lists.md](../../../export-formats/dm32/scan-lists.md).

## Adapter application

| Adapter                    | Behaviour when over limit                                            |
| -------------------------- | -------------------------------------------------------------------- |
| DM32 `dm32-baofeng-dm32uv` | Export warnings / Radio characteristics; `cps-verify` where wired    |
| NeonPlug `neonplug-dm32uv` | Same numeric caps (sync test in `formats/neonplug/profiles.test.ts`) |

Do **not** bake these into library CRUD.
