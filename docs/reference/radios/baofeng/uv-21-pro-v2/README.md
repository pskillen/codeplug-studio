# Baofeng UV-21Pro V2

Handheld analogue FM/AM radio (UV-17Pro lineage). Studio targets it via CHIRP CSV and Web Serial direct-write (`radio-io`).

|                  |                                |
| ---------------- | ------------------------------ |
| **Manufacturer** | Baofeng                        |
| **Model**        | UV-21Pro V2                    |
| **Aliases**      | UV21ProV2 (CHIRP driver class) |
| **Max RF**       | 5 W                            |

## Studio profile ids

| Adapter      | `profileId`      | Notes                                           |
| ------------ | ---------------- | ----------------------------------------------- |
| Web Serial   | `radio-io-uv21`  | PROGRAM+R/W clone; full-image Write             |
| CHIRP CSV    | `chirp-uv21`     | Generic CSV watt strings; inherits UV17Pro caps |

## Documentation map

| Doc                                | Contents                               |
| ---------------------------------- | -------------------------------------- |
| [limits.md](limits.md)             | Memory slots, name length              |
| [capabilities.md](capabilities.md) | Modes, organisation traits, RF summary |
| [power.md](power.md)               | High / Low ladder (internal %)         |
| [protocol.md](protocol.md)         | PROGRAM+R/W handshake, baud, crypt     |
| [memory-layout.md](memory-layout.md) | `MEM_*` regions, packed `0x8380`     |
| [channel-record.md](channel-record.md) | 32-byte channel element            |
| [settings.md](settings.md)         | VFO/settings retain, upload scope      |
| [fixtures.md](fixtures.md)         | Synthetic image recipe                 |

## Adapter wire

- [CHIRP export-format](../../../export-formats/chirp/README.md) — column mapping / verification

## Ground truth

| Source                                                                                                                   | Role                                                      |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| CHIRP `UV21ProV2` in [`baofeng_uv17Pro.py`](https://github.com/kk7ds/chirp/blob/master/chirp/drivers/baofeng_uv17Pro.py) | Caps, power, PROGRAM+R/W layout (inherits `UV17Pro`) |
| Studio module (when shipped) | `src/integrations/radio-io/radios/uv21-pro-v2/` |

## Related

- Sibling UV-17Pro family: [UV-5R Mini](../uv-5r-mini/README.md)
- Epic [#594](https://github.com/pskillen/codeplug-studio/issues/594) · adapter [#639](https://github.com/pskillen/codeplug-studio/issues/639)
