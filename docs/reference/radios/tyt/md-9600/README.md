# TYT MD-9600 / Retevis RT-90

Mobile DMR + analogue radio running **OpenGD77** firmware. Same CPS CSV wire layout family as the DM-1701; power ladder is radio-specific.

|                    |               |
| ------------------ | ------------- |
| **Manufacturer**   | TYT           |
| **Model**          | MD-9600       |
| **Aliases**        | Retevis RT-90 |
| **Firmware / CPS** | OpenGD77      |

## Hardware family

Shares OpenGD77 CPS and codeplug format with Baofeng DM-1701 / Retevis RT-84 (same CSV layout; watt mapping differs — see [power.md](power.md)).

## Studio profile ids

| Adapter      | `profileId`       | Notes                                                                                       |
| ------------ | ----------------- | ------------------------------------------------------------------------------------------- |
| OpenGD77 CSV | `opengd77-md9600` | Zone members 80, TG list 32, max channels 1023 (same wire as 1701 pending CPS export check) |

## Documentation map

| Doc                                | Contents                                |
| ---------------------------------- | --------------------------------------- |
| [limits.md](limits.md)             | Channels, zone/TG members               |
| [capabilities.md](capabilities.md) | Modes, `+W-` / User Power note          |
| [power.md](power.md)               | P1–P9 percent mapping + `+W-` exclusion |

## Adapter wire

- [OpenGD77 export-format](../../../export-formats/opengd77/README.md) — columns / multi-mode / zones

## Ground truth

| Source                                                                                           | Role                     |
| ------------------------------------------------------------------------------------------------ | ------------------------ |
| Operator menu elicitation ([#441](https://github.com/pskillen/codeplug-studio/issues/441))       | Power ladder validation  |
| Shipped adapter [`profiles.ts`](../../../../src/core/import-export/formats/opengd77/profiles.ts) | `OPENGD77_MD9600_LADDER` |

## Related

- Sibling OpenGD77: [Baofeng DM-1701](../../baofeng/dm-1701/README.md)
- Epic [#594](https://github.com/pskillen/codeplug-studio/issues/594) · extract [#621](https://github.com/pskillen/codeplug-studio/issues/621)
