# DM-1701 (RadioFoundry) — limits

Board facts for a Baofeng DM-1701 running RadioFoundry. Firmware-wide counts live on the [firmware-wide page](../../radiofoundry/limits.md). The codeplug file is the [RadioFoundry codeplug](../../../export-formats/radiofoundry/README.md). Cable write uses the same caps over [the programming cable](protocol.md). These numbers are the radio target's source of truth. The exporter warns or truncates at the export boundary. Library CRUD stays unlimited.

**Code:** `src/core/radios/baofeng/dm-1701-radiofoundry/limits.ts` (`DM1701_RADIOFOUNDRY_BOARD`).
**Upstream:** RadioFoundry `boards/dm1701` (`board.c`, `board.toml`) at `454a5b76`.

| Constraint             | Value                       | Notes                                                                                     |
| ---------------------- | --------------------------- | ----------------------------------------------------------------------------------------- |
| RF bands               | **136–174 and 400–480 MHz** | `BANDS_HZ`                                                                                |
| Power levels           | **5**                       | Nominal names: 100 mW, 500 mW, 1 W, 2.5 W, 5 W (`POWER_LABELS` in code)                   |
| ID database            | **520646**                  | Area 1 plus area 2 from `0xD8000` to the image end, 27 bytes a record (`ID_DATABASE_MAX`) |
| Physical codeplug base | **0**                       | `PHYSICAL_CODEPLUG_BASE`: image offset 0 sits at the start of the STM32 flash map         |
| Image end              | **0xE00000**                | `IMAGE_END`: nothing is written at or past the firmware's image end                       |

Do not bake these into library CRUD.
