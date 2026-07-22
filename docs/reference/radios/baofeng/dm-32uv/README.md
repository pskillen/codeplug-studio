# Baofeng DM-32UV

Handheld DMR + analogue dual-band radio (DM-32 family). Studio targets it via DM32 CPS CSV, NeonPlug `.neonplug`, and (planned) Web Serial direct-write.

|                  |                                                |
| ---------------- | ---------------------------------------------- |
| **Manufacturer** | Baofeng                                        |
| **Model**        | DM-32UV                                        |
| **Aliases**      | DP570UV (NeonPlug / wire model labels)         |
| **Max RF**       | High / Middle / Low (see [power.md](power.md)) |

> **CPS CSV / `.neonplug` wire ≠ binary clone memory.** File interchange lives under [export-formats/dm32](../../../export-formats/dm32/README.md) and [export-formats/neonplug](../../../export-formats/neonplug/README.md). V-frame probing, 4KB block R/W, channel records, and discovery live in the binary docs below.

**Product hub:** [radio-read-write](../../../../features/radio-read-write/README.md) · **Tracking:** [#637](https://github.com/pskillen/codeplug-studio/issues/637) (blocks adapter [#638](https://github.com/pskillen/codeplug-studio/issues/638); parent epic [#636](https://github.com/pskillen/codeplug-studio/issues/636))

## Studio profile ids

| Adapter      | `profileId`           | Notes                                                                 |
| ------------ | --------------------- | --------------------------------------------------------------------- |
| DM32 CPS CSV | `dm32-baofeng-dm32uv` | Stock CPS ladders and caps                                            |
| NeonPlug     | `neonplug-dm32uv`     | Binary / ZIP interchange; numeric caps kept in sync with DM32 profile |

## Documentation map

| Doc                                              | Contents                                                                  |
| ------------------------------------------------ | ------------------------------------------------------------------------- |
| [limits.md](limits.md)                           | Channels, zones, scan / RX / contacts / TGs, name lengths                 |
| [capabilities.md](capabilities.md)               | Modes, organisation traits                                                |
| [power.md](power.md)                             | High / Middle / Low + squelch ladder                                      |
| [protocol.md](protocol.md)                       | Baud, PSEARCH handshake, PROGRAM entry, V-frames, 4KB R/W wire, timeouts  |
| [memory-layout.md](memory-layout.md)             | V `0x0A` range, metadata discovery, type table, bulk-read set             |
| [channel-record.md](channel-record.md)           | 48-byte channel; packing 84/85 per block; TX-contact indirection          |
| [contacts-zones-lists.md](contacts-zones-lists.md) | Contacts (V `0x0F`), TGs, zones, scan, RX groups, radio IDs, TX-contact |
| [settings.md](settings.md)                       | Metadata `0x04` settings / APRS; emergency/encryption co-resident notes   |
| [fixtures.md](fixtures.md)                       | How to capture dumps for tests without committing personal codeplugs      |

## Adapter wire (files)

- [DM32 export-format](../../../export-formats/dm32/README.md) — CPS CSV columns / verification (**not** binary offsets)
- [NeonPlug export-format](../../../export-formats/neonplug/README.md) — `.neonplug` / merge / projections (**not** clone memory)

## Direct read/write (binary)

ASCII handshake → V-frame probes → PROGRAM mode → **4KB block R/W** with a metadata byte at offset `0xFFF`. This is **not** the kit’s PROGRAM+R/W `BlockCodec` (UV-5R Mini path). Studio’s V-probe kit ([#630](https://github.com/pskillen/codeplug-studio/issues/630)) covers `0x56` framing only; DM-32 block R/W stays in the radio module. See the binary docs in the map above.

## Ground truth (cite; do not copy)

No CHIRP DM-32 driver. NeonPlug is MIT — cite framing / memory maps; do **not** paste large source into Studio.

| Source                                                                                                                          | Role                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| NeonPlug [`src/radios/dm32uv/`](https://github.com/infamy/NeonPlug/tree/main/src/radios/dm32uv) (`constants`, `connection`, `memory`, `protocol`, `structures`) | Handshake, V-frames, 4KB R/W, discovery, record packing |

## Attribution

Protocol lineage credit: `/attributions` entry `neonplug` ([#597](https://github.com/pskillen/codeplug-studio/issues/597)). Planned `RadioDescriptor.attributionIds` for the DM-32UV adapter should include NeonPlug.

## Planned Studio module

`src/integrations/radio-io/radios/dm32uv/` — handshake, discovery, encode (see [protocol-kit architecture](../../../../features/radio-read-write/protocol-kit-architecture.md)). This ticket ships **docs only**.

## Related

- Parked CPS CSV fidelity: [cps-csv-gaps.md](../../../../features/import-export/dm32/cps-csv-gaps.md)
- [radio-read-write hub](../../../../features/radio-read-write/README.md)
- Epic [#636](https://github.com/pskillen/codeplug-studio/issues/636) · memory RE [#637](https://github.com/pskillen/codeplug-studio/issues/637) · adapter [#638](https://github.com/pskillen/codeplug-studio/issues/638)
