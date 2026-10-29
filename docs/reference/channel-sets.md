# Curated channel sets

Tier-2 reference for **library channel set** frequency grids — standard inventories operators commonly program. Implementation: `src/core/domain/channelSets/`. UI: **Library → Channels → Add from… → Channel set** (`/library/channels/add-channel-set`).

**Disclaimer:** Programming convenience only. Operators remain responsible for licence class, power limits, and transmit restrictions. Not authoritative for on-air operation.

Band pill classification for generated channels: [bands.md](./bands.md).

## Shipped sets (v1)

| Set ID             | Label                             | Channels | Default RX-only        |
| ------------------ | --------------------------------- | -------- | ---------------------- |
| `pmr446`           | PMR446                            | 16       | yes (`forbidTransmit`) |
| `pdmr`             | pDMR channels                     | 16       | yes (`forbidTransmit`) |
| `uk-vhf-simplex-v` | UK VHF simplex (V-channels)       | 30       | no                     |
| `uk-vhf-simplex-s` | UK VHF simplex (legacy S08–S23)   | 16       | no                     |
| `uk-uhf-simplex-u` | UK UHF simplex (U-channels)       | 17       | no                     |
| `uk-uhf-simplex-s` | UK UHF simplex (legacy SU16–SU32) | 17       | no                     |
| `uk-cb-2781`       | UK CB (27/81)                     | 40       | no                     |
| `eu-cb-cept`       | EU / CEPT CB                      | 40       | no                     |

All analogue sets default to **12.5 kHz** FM bandwidth in the library model; the UI allows **25 kHz** override (hidden for the DMR set `pdmr`, which is fixed 12.5 kHz TDMA). VHF and UHF simplex grids are also available under **legacy naming** — pick one set per band when adding to the library.

## PMR446

ETSI PMR446: 16 channels, 12.5 kHz spacing, 446.00625–446.19375 MHz. Names `PMR446-1`…`16`. Analogue FM in the library model.

Source: [ETSI PMR446](https://www.etsi.org/).

## pDMR channels

pDMR (DMR Tier 1, licence-free): the same 16 channels and frequencies as PMR446 (446.00625-446.19375 MHz, 12.5 kHz), named `pDMR-1`...`16`. Imported as **DMR** channels: direct-mode **simplex** (`dmo-simplex`), **colour code 1**, **timeslot 1**, RX = TX. No contact or RX group list is attached (vendor-neutral; assign a talk group such as the common simplex convention TG 99 in the library after import). Default `forbidTransmit`, like PMR446.

Dedup compares RX frequency **per mode family**: a DMR pDMR channel is not skipped because an analogue PMR446 channel already sits on the same frequency (and vice versa). Names are checked as before.

Assumptions: sources agree on the 12.5 kHz grid shared with analogue PMR446, with all 16 channels allowed for DMR Tier 1 since January 2018; CC1/TS1 is the common community convention, not a regulatory requirement. Sources: [PMR446 (Wikipedia)](https://en.wikipedia.org/wiki/PMR446), [Kenwood PMR446 white paper](https://kenwoodcommunications.co.uk/files/file/comms/uk/pmr446/PMR446-White-Paper-V6_18AUG2016_JT_KB.pdf), [DMR446](http://dmr446.hamstation.eu/index_en.htm).

## UK 2 m FM simplex (V-channels)

Per [RSGB 144 MHz band plan](https://rsgb.org/main/operating/band-plans/vhf-uhf/144mhz-band/): V16–V45, 12.5 kHz spacing, 145.200–145.5625 MHz. National FM calling: **V40** (145.500 MHz).

| V       | MHz         |
| ------- | ----------- |
| V16     | 145.200     |
| …       | …           |
| **V40** | **145.500** |
| …       | …           |
| V45     | 145.5625    |

## UK 2 m FM simplex (legacy S08–S23)

Historic S-channels on **even** V-channel frequencies only (16 channels). Calling **S20** @ 145.500 MHz.

| S       | MHz         |
| ------- | ----------- |
| S08     | 145.200     |
| S09     | 145.225     |
| …       | …           |
| **S20** | **145.500** |
| …       | …           |
| S23     | 145.575     |

## UK 70 cm FM simplex (U-channels)

Per [RSGB 432 MHz band plan](https://rsgb.org/main/operating/band-plans/vhf-uhf/432mhz-band/): U272–U288, 12.5 kHz spacing, 433.400–433.600 MHz. National FM calling: **U280** (433.500 MHz).

| U (current) | MHz         |
| ----------- | ----------- |
| U272        | 433.400     |
| …           | …           |
| **U280**    | **433.500** |
| …           | …           |
| U288        | 433.600     |

## UK 70 cm FM simplex (legacy SU16–SU32)

Same frequencies as U-channels; legacy **SU** prefix. Calling **SU24** @ 433.500 MHz.

| U (legacy) | MHz         |
| ---------- | ----------- |
| SU16       | 433.400     |
| …          | …           |
| **SU24**   | **433.500** |
| …          | …           |
| SU32       | 433.600     |

## UK CB (27/81)

40 channels, 10 kHz spacing, 27.60125–27.99125 MHz. Names `UK CB 1`…`40`.

Source: [Ofcom CB guidance](https://www.ofcom.org.uk/).

## EU / CEPT CB

40 channels, 10 kHz spacing, 26.965–27.355 MHz (channel 40). Names `EU CB 1`…`40`.

## Deferred sets

Full ITU marine VHF, airband subsets, US FRS/GMRS, other DMR simplex grids, extended simplex beyond V45 / U288.

## Related

- [Library CRUD — channel sets](../features/library/README.md#channel-sets-172)
- [bands.md](./bands.md)
