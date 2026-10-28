# RT95 VOX — limits

Code mirror: `src/core/radios/retevis/rt95/limits.ts` (`RT95_LIMITS`).

Shared hardware / memory caps. Adapters warn or truncate at the **export / write boundary** — library CRUD stays unlimited.

| Constraint                                             | Value       | Notes                                                  |
| ------------------------------------------------------ | ----------- | ------------------------------------------------------ |
| Max memory slots / channels                            | **200**     | CHIRP `memory_bounds=(1, 200)`                         |
| Channel name                                           | **6** chars | Tightest CHIRP profile in Studio; shortening at export |
| Zone / scan-list / contact / TG / RX-list organisation | N/A         | Flat-memory radio — those entities unused              |

Caps match CHIRP `RetevisRT95vox` — see [enum-verification.md](../../../export-formats/chirp/enum-verification.md).

## MM9PDY target

Code mirror: the `ZONE_*` and `DESCRIPTION_LENGTH` entries of `RT95_LIMITS`. These apply only to the MM9PDY modded firmware (MMD1 v1 data table, see [mm9pdy-data.md](mm9pdy-data.md)); the stock target has no zones or descriptions.

| Constraint          | Value                                 | Notes                                                      |
| ------------------- | ------------------------------------- | ---------------------------------------------------------- |
| Zones               | **32**                                | Zones with no members are dropped before writing           |
| Zone name           | **8** chars, printable ASCII          | 0x20-0x7E                                                  |
| Zone members        | any of the **200** channels           | A zone is a set; the radio visits members in channel order |
| Channel description | **12** chars, printable ASCII, no `_` | `_` renders blank in the head's font; empty is not written |

## Adapter application

| Adapter            | Behaviour when over limit                                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| CHIRP `chirp-rt95` | Warn when channel count exceeds; truncate lowest-priority rows if forced; `cps-verify` enforces memory-slot and name-length caps |

See [capabilities.md](capabilities.md) for mode skip rules.
