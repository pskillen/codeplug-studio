# Baofeng UV-5R Mini

Handheld analogue FM/AM radio (UV-17Pro lineage). Studio targets it via CHIRP CSV, NeonPlug `.neonplug`, and (planned) Web Serial direct-write.

|                  |                                    |
| ---------------- | ---------------------------------- |
| **Manufacturer** | Baofeng                            |
| **Model**        | UV-5R Mini                         |
| **Aliases**      | UV5R-Mini (NeonPlug / wire labels) |
| **Max RF**       | 5 W                                |

## Studio profile ids

| Adapter   | `profileId`         | Notes                                                    |
| --------- | ------------------- | -------------------------------------------------------- |
| CHIRP CSV | `chirp-uv5r`        | Generic CSV watt strings                                 |
| NeonPlug  | `neonplug-uv5rmini` | Binary / ZIP interchange; optional Web Serial path later |

## Documentation map

| Doc                                  | Contents                                        |
| ------------------------------------ | ----------------------------------------------- |
| [limits.md](limits.md)               | Memory slots, name length                       |
| [capabilities.md](capabilities.md)   | Modes, organisation traits, RF summary          |
| [power.md](power.md)                 | High / Low ladder (internal %)                  |
| [memory-layout.md](memory-layout.md) | Clone image regions + PROGRAM+R/W protocol stub |

## Adapter wire

- [CHIRP export-format](../../../export-formats/chirp/README.md) — column mapping / verification
- [NeonPlug export-format](../../../export-formats/neonplug/README.md) — `.neonplug` / merge / settings bag

## Ground truth

| Source                                                                                                                  | Role                             |
| ----------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| CHIRP `UV5RMini` in [`baofeng_uv17Pro.py`](https://github.com/kk7ds/chirp/blob/master/chirp/drivers/baofeng_uv17Pro.py) | Caps, R/W protocol, crypt        |
| NeonPlug [`src/radios/uv5rmini/`](https://github.com/infamy/NeonPlug/tree/main/src/radios/uv5rmini)                     | Browser framing, channel mapping |

## Related

- [radio-read-write hub](../../../../features/radio-read-write/README.md)
- [protocol-kit architecture](../../../../features/radio-read-write/protocol-kit-architecture.md)
- Epic [#594](https://github.com/pskillen/codeplug-studio/issues/594) · extract [#621](https://github.com/pskillen/codeplug-studio/issues/621)
