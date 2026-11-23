/**
 * Retevis RT84 running RadioFoundry firmware: board facts (RadioFoundry boards/dm1701/board.toml,
 * boards/dm1701/board.c at 454a5b76). Code mirror of docs/reference/radios/retevis/rt84-radiofoundry/limits.md.
 * Firmware-wide counts live in `@core/radios/radiofoundry/limits.ts`. Export boundary only; not library CRUD.
 */
import {
  RADIOFOUNDRY_LIMITS,
  type RadioFoundryBoardLimits,
} from '@core/radios/radiofoundry/limits.ts';

export const RT84_RADIOFOUNDRY_BOARD: RadioFoundryBoardLimits = {
  BANDS_HZ: [
    { minHz: 136_000_000, maxHz: 174_000_000 },
    { minHz: 400_000_000, maxHz: 480_000_000 },
  ],
  POWER_LEVELS: 5,
  /** The firmware's level names, lowest first (boards/dm1701/board.c:82). Nominal; not measured by Studio. */
  POWER_LABELS: ['100 mW', '500 mW', '1 W', '2.5 W', '5 W'],
  /** Area 1 plus area 2 from 0xD8000 to the image end, 27 bytes a record; a test pins it to the layout. */
  ID_DATABASE_MAX: 520_646,
  PHYSICAL_CODEPLUG_BASE: 0,
  IMAGE_END: 0xe0_0000,
};

export const RT84_RADIOFOUNDRY_LIMITS = {
  ...RADIOFOUNDRY_LIMITS,
  POWER_LEVELS: RT84_RADIOFOUNDRY_BOARD.POWER_LEVELS,
  ID_DATABASE_MAX: RT84_RADIOFOUNDRY_BOARD.ID_DATABASE_MAX,
} as const;
