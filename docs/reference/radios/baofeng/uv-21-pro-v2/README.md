# Baofeng UV-21Pro V2

Handheld analogue FM/AM radio (UV-17Pro lineage). Studio targets it via CHIRP CSV.

|                  |                                |
| ---------------- | ------------------------------ |
| **Manufacturer** | Baofeng                        |
| **Model**        | UV-21Pro V2                    |
| **Aliases**      | UV21ProV2 (CHIRP driver class) |
| **Max RF**       | 5 W                            |

## Studio profile ids

| Adapter   | `profileId`  | Notes                                           |
| --------- | ------------ | ----------------------------------------------- |
| CHIRP CSV | `chirp-uv21` | Generic CSV watt strings; inherits UV17Pro caps |

## Documentation map

| Doc                                | Contents                               |
| ---------------------------------- | -------------------------------------- |
| [limits.md](limits.md)             | Memory slots, name length              |
| [capabilities.md](capabilities.md) | Modes, organisation traits, RF summary |
| [power.md](power.md)               | High / Low ladder (internal %)         |

## Adapter wire

- [CHIRP export-format](../../../export-formats/chirp/README.md) — column mapping / verification

## Ground truth

| Source                                                                                                                   | Role                                                      |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| CHIRP `UV21ProV2` in [`baofeng_uv17Pro.py`](https://github.com/kk7ds/chirp/blob/master/chirp/drivers/baofeng_uv17Pro.py) | Caps, power (inherits UV17Pro `CHANNELS` / `LENGTH_NAME`) |

## Related

- Sibling UV-17Pro family: [UV-5R Mini](../uv-5r-mini/README.md)
- Epic [#594](https://github.com/pskillen/codeplug-studio/issues/594) · extract [#621](https://github.com/pskillen/codeplug-studio/issues/621)
