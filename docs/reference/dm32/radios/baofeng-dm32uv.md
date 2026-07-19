# Baofeng DM-32UV — radio profile

Stock CPS v1.60 calibration for import/export ladders and caps.

**Code:** [`profiles.ts`](../../../../src/core/import-export/formats/dm32/profiles.ts)

## Capacity (provisional)

| Entity                | Cap                                    |
| --------------------- | -------------------------------------- |
| Channels              | ~1000                                  |
| Zone members          | No hard export cap in #67              |
| RX group list members | 32                                     |
| Scan list members     | **15** named CSV members (CPS “16” includes implicit current channel; [#486](https://github.com/pskillen/codeplug-studio/issues/486)) |

## Power ladder

| Wire     | Internal `power` % |
| -------- | ------------------ |
| `High`   | 100                |
| `Middle` | 50                 |
| `Low`    | 20                 |

Unset / empty → `null` (export defaults to `High`).

## Squelch ladder

| Wire `Squelch Level` | Internal `squelch` %     |
| -------------------- | ------------------------ |
| `0`–`9`              | `round(level × 100 / 9)` |

Analog and digital channels use the same ladder on DM32.

## Default profile id

`dm32-baofeng-dm32uv` — only profile in #67.
