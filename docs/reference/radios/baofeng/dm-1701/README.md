# Baofeng DM-1701 / Retevis RT-84

Handheld DMR + analogue radio running **OpenGD77** firmware. First documented OpenGD77 profile in Studio; matches today’s shipped import/export adapter constants.

|                    |               |
| ------------------ | ------------- |
| **Manufacturer**   | Baofeng       |
| **Model**          | DM-1701       |
| **Aliases**        | Retevis RT-84 |
| **Firmware / CPS** | OpenGD77      |

## Hardware family

TYT MD-UV380 / Retevis RT-3S / Baofeng DM-1701 / Retevis RT-84 share OpenGD77 CPS and codeplug format (same CSV layout family; watt mapping is radio-specific — see [power.md](power.md)).

## Studio profile ids

| Adapter      | `profileId`     | Notes                                          |
| ------------ | --------------- | ---------------------------------------------- |
| OpenGD77 CSV | `opengd77-1701` | Zone members 80, TG list 32, max channels 1023 |

## Documentation map

| Doc                                | Contents                                              |
| ---------------------------------- | ----------------------------------------------------- |
| [limits.md](limits.md)             | Channels, zone/TG members, names, TOT, colour code    |
| [capabilities.md](capabilities.md) | Modes, APRS/DTMF modelling, layout conventions        |
| [power.md](power.md)               | P1–P9 percent mapping + link to generic wire spelling |
| [OpenGD77 binary memory](../../opengd77/README.md) | Shared EEPROM/FLASH map + serial protocol (direct I/O) |

## Adapter wire

- [OpenGD77 export-format](../../../export-formats/opengd77/README.md) — CPS CSV columns / multi-mode / zones (**not** binary offsets)
- Direct read/write memory: [radios/opengd77](../../opengd77/README.md)

## Ground truth

| Source                                                                                                                         | Role                                                    |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| [G4EML CSV Export and Import Features (PDF)](https://www.opengd77.com/downloads/PC_CPS/Latest/OpenGD77_CPS_CSV%20Features.pdf) | Caps, TOT, colour code                                  |
| Shipped adapter [`columns.ts`](../../../../src/core/import-export/formats/opengd77/columns.ts)                                 | `zoneMemberHeaders(80)`, `rxGroupListMemberHeaders(32)` |

## Related

- Epic [#594](https://github.com/pskillen/codeplug-studio/issues/594) · extract [#621](https://github.com/pskillen/codeplug-studio/issues/621)
