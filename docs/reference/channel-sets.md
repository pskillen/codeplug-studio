# Curated channel sets

Tier-2 reference for **library channel set** frequency grids — standard inventories operators commonly program. Implementation: `src/core/domain/channelSets/`. UI: **Library → Channels → Add channel set…** (`/library/channels/add-channel-set`).

**Disclaimer:** Programming convenience only. Operators remain responsible for licence class, power limits, and transmit restrictions. Not authoritative for on-air operation.

Band pill classification for generated channels: [bands.md](./bands.md).

## Shipped sets (v1)

| Set ID | Label | Channels | Default RX-only |
| --- | --- | --- | --- |
| `pmr446` | PMR446 | 16 | yes (`forbidTransmit`) |
| `uk-vhf-simplex-v` | UK VHF simplex (V-channels) | 30 | no |
| `uk-vhf-simplex-s` | UK VHF simplex (S-channels) | 30 | no |
| `uk-uhf-simplex-u` | UK UHF simplex (U-channels) | 17 | no |
| `uk-uhf-simplex-s` | UK UHF simplex (legacy U16–U32) | 17 | no |
| `uk-cb-2781` | UK CB (27/81) | 40 | no |
| `eu-cb-cept` | EU / CEPT CB | 40 | no |

VHF and UHF simplex grids are stored **twice** (current and legacy naming) at the **same frequencies** — pick one set per band when adding to the library.

## PMR446

ETSI PMR446: 16 channels, 12.5 kHz spacing, 446.00625–446.19375 MHz. Names `PMR446-1`…`16`. Analogue FM NFM 12.5 kHz in the library model.

Source: [ETSI PMR446](https://www.etsi.org/).

## UK 2 m FM simplex (V / S channels)

Per [RSGB 144 MHz band plan](https://rsgb.org/main/operating/band-plans/vhf-uhf/144mhz-band/): V16–V45, 12.5 kHz spacing, 145.200–145.5625 MHz. National FM calling: **V40** (145.500 MHz), legacy **S20**.

| V | S (legacy) | MHz |
| --- | --- | --- |
| V16 | S08 | 145.200 |
| V17 | S31 | 145.2125 |
| V18 | S09 | 145.225 |
| V19 | S32 | 145.2375 |
| V20 | S10 | 145.250 |
| V21 | S33 | 145.2625 |
| V22 | S11 | 145.275 |
| V23 | S34 | 145.2875 |
| V24 | S12 | 145.300 |
| V25 | S35 | 145.3125 |
| V26 | S13 | 145.325 |
| V27 | S36 | 145.3375 |
| V28 | S14 | 145.350 |
| V29 | S37 | 145.3625 |
| V30 | S15 | 145.375 |
| V31 | S38 | 145.3875 |
| V32 | S16 | 145.400 |
| V33 | S39 | 145.4125 |
| V34 | S17 | 145.425 |
| V35 | S40 | 145.4375 |
| V36 | S18 | 145.450 |
| V37 | S41 | 145.4625 |
| V38 | S19 | 145.475 |
| V39 | S42 | 145.4875 |
| **V40** | **S20** | **145.500** |
| V41 | S43 | 145.5125 |
| V42 | S21 | 145.525 |
| V43 | S44 | 145.5375 |
| V44 | S22 | 145.550 |
| V45 | S45 | 145.5625 |

Even V-channels use historic S08–S22 where applicable; odd V-channels use S31–S45 (no historic S designator in the band plan).

## UK 70 cm FM simplex (U-channels)

Per [RSGB 432 MHz band plan](https://rsgb.org/main/operating/band-plans/vhf-uhf/432mhz-band/): U272–U288, 12.5 kHz spacing, 433.400–433.600 MHz. National FM calling: **U280** (433.500 MHz). Legacy numbering **U16–U32** uses the same frequencies (fixture-aligned; calling **U24**).

| U (current) | U (legacy) | MHz |
| --- | --- | --- |
| U272 | U16 | 433.400 |
| U273 | U17 | 433.4125 |
| U274 | U18 | 433.425 |
| U275 | U19 | 433.4375 |
| U276 | U20 | 433.450 |
| U277 | U21 | 433.4625 |
| U278 | U22 | 433.475 |
| U279 | U23 | 433.4875 |
| **U280** | **U24** | **433.500** |
| U281 | U25 | 433.5125 |
| U282 | U26 | 433.525 |
| U283 | U27 | 433.5375 |
| U284 | U28 | 433.550 |
| U285 | U29 | 433.5625 |
| U286 | U30 | 433.575 |
| U287 | U31 | 433.5875 |
| U288 | U32 | 433.600 |

## UK CB (27/81)

40 channels, 10 kHz spacing, 27.60125–27.99125 MHz. Names `UK CB 1`…`40`.

Source: [Ofcom CB guidance](https://www.ofcom.org.uk/).

## EU / CEPT CB

40 channels, 10 kHz spacing, 26.965–27.355 MHz (channel 40). Names `EU CB 1`…`40`.

## Deferred sets

Full ITU marine VHF, airband subsets, US FRS/GMRS, DMR simplex grids, extended simplex beyond V45 / U288 (e.g. fixture V46 @ 145.575 MHz).

## Related

- [Library CRUD — channel sets](../features/library/README.md#channel-sets-172)
- [bands.md](./bands.md)
