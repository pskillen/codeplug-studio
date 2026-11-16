# RT95 VOX — limits

Code mirror: `src/core/radios/retevis/rt95/limits.ts` (`RT95_LIMITS`).

Shared hardware / memory caps. Adapters warn or truncate at the **export / write boundary** — library CRUD stays unlimited.

| Constraint                                             | Value                                    | Notes                                                                                                                                                   |
| ------------------------------------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Max memory slots / channels                            | **200**                                  | CHIRP `memory_bounds=(1, 200)`                                                                                                                          |
| Channel name                                           | **6** chars                              | Tightest CHIRP profile in Studio; shortening at export                                                                                                  |
| Channel name characters (stock target)                 | printable ASCII                          | Folded at write time, case kept. The stock CPS accepts only `0-9 A-Z -` and shows the rest as spaces (F122); Studio notes this in the wire-name preview |
| Frequency step                                         | 9 steps                                  | 2.5, 5, 6.25, 10, 12.5, 20, 25, 30, 50 kHz, stored 0-8 at `0x3201`; no per-channel step is stored (F125)                                                |
| CTCSS / DCS                                            | 51 tones + custom / any 9-bit octal code | Studio writes the 51 tones and the 512-code DCS index; custom CTCSS is a gap ([channel-record.md](channel-record.md))                                   |
| Channel width                                          | 12.5 / 20 / 25 kHz                       | Studio writes 12.5 and 25; 20 is written as 25 with a warning                                                                                           |
| Zone / scan-list / contact / TG / RX-list organisation | N/A                                      | Flat-memory radio — those entities unused                                                                                                               |

Caps match CHIRP `RetevisRT95vox` — see [enum-verification.md](../../../export-formats/chirp/enum-verification.md).

Studio protects EEPROM `0x3B00–0x3FFF` (production identity, factory calibration and signature), including its 16 KiB and 32 KiB chip-size aliases and wrapping or overflowing ranges. Clone writes are limited to stock blocks through `0x3290` and, on the MM9PDY target after a successful chip-size check, MMD1 blocks at `0x4000–0x5FF0`; the radio-owned state block is reserved for Restore. The clone transport refuses unknown factory, repair and reset commands. The separate firmware updater writes MCU flash through its own guarded bootloader protocol.

## MM9PDY target

Code mirror: the `ZONE_*` and `DESCRIPTION_LENGTH` entries of `RT95_LIMITS`. These apply only to the MM9PDY modded firmware (MMD1 v1 data table, see [mm9pdy-data.md](mm9pdy-data.md)); the stock target has no zones or descriptions.

| Constraint          | Value                                 | Notes                                                           |
| ------------------- | ------------------------------------- | --------------------------------------------------------------- |
| Zones               | **32**                                | Zones with no members are dropped before writing                |
| Zone name           | **12** chars, printable ASCII         | Bytes 0–11 of the name block; the head copies all 12. 0x20-0x7E |
| Zone members        | any of the **200** channels           | A zone is a set; the radio visits members in channel order      |
| Channel description | **12** chars, printable ASCII, no `_` | `_` renders blank in the head's font; empty is not written      |

## Adapter application

| Adapter            | Behaviour when over limit                                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| CHIRP `chirp-rt95` | Warn when channel count exceeds; truncate lowest-priority rows if forced; `cps-verify` enforces memory-slot and name-length caps |

See [capabilities.md](capabilities.md) for mode skip rules.
