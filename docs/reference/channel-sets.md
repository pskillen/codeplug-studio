# Curated channel sets

Tier-2 reference for **library channel set** frequency grids — standard inventories operators commonly program. Implementation: `src/core/domain/channelSets/`. UI: **Library → Channels → Add from… → Channel set** (`/library/channels/add-channel-set`).

**Disclaimer:** Programming convenience only. Operators remain responsible for licence class, power limits, and transmit restrictions. Not authoritative for on-air operation.

Band pill classification for generated channels: [bands.md](./bands.md).

## Shipped sets (v1)

| Set ID             | Label                             | Channels | Default RX-only        |
| ------------------ | --------------------------------- | -------- | ---------------------- |
| `pmr446`           | PMR446                            | 16       | yes (`forbidTransmit`) |
| `dmr446`           | DMR446 (16 channels)              | 16       | yes (`forbidTransmit`) |
| `dpmr446-16`       | dPMR446 (16 channels)             | 16       | yes (`forbidTransmit`) |
| `dpmr446-32`       | dPMR446 (32 channels)             | 32       | yes (`forbidTransmit`) |
| `uk-vhf-simplex-v` | UK VHF simplex (V-channels)       | 30       | no                     |
| `uk-vhf-simplex-s` | UK VHF simplex (legacy S08–S23)   | 16       | no                     |
| `uk-uhf-simplex-u` | UK UHF simplex (U-channels)       | 17       | no                     |
| `uk-uhf-simplex-s` | UK UHF simplex (legacy SU16–SU32) | 17       | no                     |
| `uk-cb-2781`       | UK CB (27/81)                     | 40       | no                     |
| `eu-cb-cept`       | EU / CEPT CB                      | 40       | no                     |

All analogue sets default to **12.5 kHz** FM bandwidth in the library model; the UI allows **25 kHz** override (hidden for the DMR set `dmr446`, which is fixed 12.5 kHz TDMA). VHF and UHF simplex grids are also available under **legacy naming** — pick one set per band when adding to the library.

## PMR446

ETSI PMR446: 16 channels, 12.5 kHz spacing, 446.00625–446.19375 MHz. Names `PMR446-1`…`16`. Analogue FM in the library model.

Source: [ETSI PMR446](https://www.etsi.org/).

## DMR446 (16 channels)

DMR446 (DMR Tier 1, licence-free, TDMA): the same 16 channels as analogue PMR446 (446.00625-446.19375 MHz, 12.5 kHz), named `DMR446-1`...`16`. Imported as **DMR** channels: direct-mode **simplex** (`dmo-simplex`), **colour code 1**, **timeslot 1**, RX = TX. No contact or RX group list is attached (vendor-neutral; assign a talk group such as the common simplex convention TG 99 after import). Default `forbidTransmit`, like PMR446. CC1/TS1 are community convention, not regulation; the 12.5 kHz grid is shared with analogue PMR446 (all 16 channels allowed for DMR Tier 1 since January 2018).

## dPMR446 (16 and 32 channels)

dPMR446 is a different licence-free digital standard: **FDMA** (not DMR/TDMA), 6.25 kHz channels. The 446.0-446.2 MHz band holds 16 channels on the 12.5 kHz grid (`dpmr446-16`, 446.00625-446.19375 MHz, `dPMR446-1`...`16`) or 32 on the 6.25 kHz grid (`dpmr446-32`, 446.003125-446.196875 MHz, `dPMR32-1`...`32`). The 6.25 kHz grid is offset 3.125 kHz from the 12.5 kHz grid, so the two sets share no frequency.

**Known gap:** the library has no dPMR channel mode yet, so both sets import as frequency-only **FM-style** channels (12.5 kHz bandwidth, no colour code or timeslot). Do not export them to a radio as analogue FM expecting dPMR behaviour. A follow-up should add a vendor-neutral `dpmr` mode profile (and export mapping where radios support it), then switch these sets to it.

Sources: [dPMR Association](https://dpmrassociation.org/dPMR-446.html), [PMR446 (Wikipedia)](https://en.wikipedia.org/wiki/PMR446), [DMR446 notes](http://dmr446.hamstation.eu/index_en.htm).

**Dedup:** RX frequency is compared **per mode family**: DMR446 channels are not skipped because analogue PMR446 channels sit on the same frequencies. dPMR446 (16) is FM-style, so it is skipped on RX Hz when analogue PMR446 is already imported. All three new sets use distinct channel names and can be imported side by side.

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
