/**
 * TYT MD-9600 running RadioFoundry firmware: board facts (RadioFoundry boards/md9600/board.toml,
 * boards/md9600/board.c at 454a5b76). Power measured upstream with a wattmeter on V1–V3 boards.
 * Code mirror of docs/reference/radios/tyt/md-9600-radiofoundry/limits.md.
 * Firmware-wide counts live in `@core/radios/radiofoundry/limits.ts`. Export boundary only; not library CRUD.
 */
import {
  RADIOFOUNDRY_LIMITS,
  type RadioFoundryBoardLimits,
} from '@core/radios/radiofoundry/limits.ts';

export const MD9600_RADIOFOUNDRY_BOARD: RadioFoundryBoardLimits = {
  BANDS_HZ: [
    { minHz: 136_000_000, maxHz: 174_000_000 },
    { minHz: 400_000_000, maxHz: 480_000_000 },
  ],
  POWER_LEVELS: 5,
  /** The firmware's level names, lowest first (boards/md9600/board.c:31-38). Nominal; not measured by Studio. */
  POWER_LABELS: [
    '250 mW VHF / 100 mW UHF',
    '1 W',
    '5 W',
    '25 W',
    '50 W VHF / 45 W UHF',
  ],
  /** Area 1 plus area 2 from 0xD8000 to the image end, 27 bytes a record; a test pins it to the layout. */
  ID_DATABASE_MAX: 520_646,
  PHYSICAL_CODEPLUG_BASE: 0,
  IMAGE_END: 0xe0_0000,
};

export const MD9600_RADIOFOUNDRY_LIMITS = {
  ...RADIOFOUNDRY_LIMITS,
  POWER_LEVELS: MD9600_RADIOFOUNDRY_BOARD.POWER_LEVELS,
  ID_DATABASE_MAX: MD9600_RADIOFOUNDRY_BOARD.ID_DATABASE_MAX,
} as const;