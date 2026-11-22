# DM-32UV (RadioFoundry) — limits

Board facts for a Baofeng DM-32UV running RadioFoundry. The counts every RadioFoundry radio shares (channels, zones, contacts, RX lists, names, radio ID) are on the [firmware-wide page](../../radiofoundry/limits.md). The codeplug file is the [RadioFoundry codeplug](../../../export-formats/radiofoundry/README.md). Cable write uses the same caps over [the programming cable](protocol.md). These numbers are the radio target's source of truth. The exporter warns or truncates at the export boundary. Library CRUD stays unlimited.

**Code:** `src/core/radios/baofeng/dm-32uv-radiofoundry/limits.ts` (`DM32UV_RADIOFOUNDRY_BOARD`). `DM32UV_RADIOFOUNDRY_LIMITS` combines it with the firmware-wide counts for the format and cable profiles.
**Upstream:** RadioFoundry `boards/dm32` (`board.c`, `board.toml`) at `454a5b76`.

| Constraint             | Value                       | Notes                                                                                                                                                                                                                  |
| ---------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RF bands               | **136–174 and 400–480 MHz** | `BANDS_HZ`. A channel frequency outside them is an export warning. See [capabilities](capabilities.md)                                                                                                                 |
| Power levels           | **9**                       | `POWER_LEVELS`. Watt values are unmeasured. Do not invent a watt ladder yet.                                                                                                                                           |
| ID database            | **287629**                  | DMR ID database records the Write sends: area 1 plus the part of area 2 that ends at the native codeplug, 27 bytes each. `ID_DATABASE_MAX`; a test pins it to the layout in `idDatabase.ts`. Not the 1024 contact bank |
| Physical codeplug base | **0x700000**                | `PHYSICAL_CODEPLUG_BASE`: where the board puts image offset 0. The radio adds it; a host sends image offsets only                                                                                                      |
| Image end              | **0x800000**                | `IMAGE_END`: the firmware's end (`0xF00000`) less the base. The native codeplug starts here; nothing is written at or past it                                                                                          |

Do not bake these into library CRUD.
