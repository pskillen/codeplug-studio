# Baofeng DM-32UV — radio profile

Stock CPS calibration for import/export ladders and caps. Entity and member
counts researched from [NeonPlug DM-32UV `LIMITS`](https://github.com/infamy/NeonPlug/blob/main/src/radios/dm32uv/constants.ts)
and NeonPlug model comments ([tier-3 NeonPlug reference](../../neonplug/radios/dm32uv.md));
zone name length confirmed on radio hardware.

**Code:** [`profiles.ts`](../../../../src/core/import-export/formats/dm32/profiles.ts)

## Capacity

| Entity                | Cap                                                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Channels              | **4000**                                                                                                                              |
| Zones                 | **250**                                                                                                                               |
| Zone members          | **64** (distinct from scan-list member cap)                                                                                           |
| Scan lists            | **32**                                                                                                                                |
| Scan list members     | **15** named CSV members (CPS “16” includes implicit current channel; [#486](https://github.com/pskillen/codeplug-studio/issues/486)) |
| RX group lists        | **32**                                                                                                                                |
| RX group list members | **32**                                                                                                                                |
| Contacts              | **250**                                                                                                                               |
| Talk groups           | **800**                                                                                                                               |
| Channel / zone names  | **16** (`nameLimit` — channel LCD + radio-confirmed zone)                                                                             |
| Contact / TG names    | **16** (`nameLimit`)                                                                                                                  |
| Scan list names       | **10** (`scanListNameLimit` — conservative; CPS official 11, NeonPlug radio field 10)                                                 |
| RX group list names   | **10** (`rxGroupListNameLimit` — NeonPlug RXGroup 11-byte null-terminated field)                                                      |

Zone-derived scan lists synthesise at most **15** named members even when a zone has up to **64** members — intentional export loss; see [scan-lists.md](../scan-lists.md).

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
