# Baofeng UV-5R Mini — radio protocol reference

> **Studio status:** Architecture stub only ([#603](https://github.com/pskillen/codeplug-studio/issues/603)). Full frame / memory tables land with the first UV-5R Mini WebSerial implementation ticket under epic [#594](https://github.com/pskillen/codeplug-studio/issues/594).

Tier-3 reference for the **UV-5R Mini** (and closely related Mini-family) **binary radio protocol** used for in-browser read/write. This is **not** the CHIRP CSV file adapter — CSV wire tables stay under [chirp/](../../formats/chirp/README.md).

**Product hub:** [radio-read-write](../../../features/radio-read-write/README.md) · **Architecture:** [protocol-kit-architecture.md](../../../features/radio-read-write/protocol-kit-architecture.md)

## Scope

| In scope                                                              | Out of scope                                                    |
| --------------------------------------------------------------------- | --------------------------------------------------------------- |
| PROGRAM + R/W clone protocol, memory regions, firmware string offsets | Classic UV-5R **S/X** protocol (separate family when scheduled) |
| Serial and optional BLE transport notes for this radio                | Library channel field semantics (tier 1)                        |
| Attribution to CHIRP / NeonPlug lineages                              | Replacing NeonPlug as a product                                 |

## Ground truth

| Source                                                                                                                       | Role                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [CHIRP `baofeng_uv17Pro.py`](https://github.com/kk7ds/chirp/blob/master/chirp/drivers/baofeng_uv17Pro.py) — class `UV5RMini` | Ident `PROGRAMCOLORPROU`, `MEM_TOTAL = 0x8240`, regions, BLE upload block size |
| [NeonPlug `src/radios/uv5rmini/`](https://github.com/infamy/NeonPlug/tree/main/src/radios/uv5rmini)                          | Browser Web Serial / BLE framing, channel image mapping                        |
| NeonPlug [`src/radios/README.md`](https://github.com/infamy/NeonPlug/blob/main/src/radios/README.md)                         | Descriptor registration pattern Studio will mirror                             |

## Protocol summary (stub)

| Property          | Value                                                             |
| ----------------- | ----------------------------------------------------------------- |
| Family            | Baofeng UV-17Pro lineage (not classic UV-5R S/X)                  |
| Baud (serial)     | 38400                                                             |
| Ident             | `PROGRAMCOLORPROU`                                                |
| Read / write cmds | `R` (`0x52`) / `W` block frames; ACK `0x06`                       |
| Assembled image   | `0x8240` bytes (sparse regions assembled into one map)            |
| Channels          | Up to 999                                                         |
| Obfuscation       | Optional XOR crypt on payloads (CHIRP `_crypt` / NeonPlug tables) |
| BLE               | Same framing; larger upload block size on some paths              |

Detailed address maps, channel struct layouts, and settings offsets will be added here when the radio adapter ships — keep wire tables in this directory only (not in `docs/features/`).

## Related

- [CHIRP CSV reference](../../formats/chirp/README.md) — file interchange for UV-5R profiles
- [NeonPlug interchange](../../formats/neonplug/README.md) — `.neonplug` ZIP (preferred file path before direct write)
