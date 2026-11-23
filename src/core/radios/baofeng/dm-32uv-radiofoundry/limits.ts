/**
 * Baofeng DM-32UV running RadioFoundry firmware: board facts (RadioFoundry boards/dm32 at 454a5b76).
 * Code mirror of [limits.md](../../../../docs/reference/radios/baofeng/dm-32uv-radiofoundry/limits.md).
 * Firmware-wide counts live in `@core/radios/radiofoundry/limits.ts`. The codeplug exporter reads these
 * caps. Not library CRUD.
 */
import {
  RADIOFOUNDRY_LIMITS,
  type RadioFoundryBoardLimits,
} from '@core/radios/radiofoundry/limits.ts';

export const DM32UV_RADIOFOUNDRY_BOARD: RadioFoundryBoardLimits = {
  BANDS_HZ: [
    { minHz: 136_000_000, maxHz: 174_000_000 },
    { minHz: 400_000_000, maxHz: 480_000_000 },
  ],
  /** Power steps. Watt values are unmeasured. */
  POWER_LEVELS: 9,
  /**
   * Records the DMR ID database holds: area 1 (`0x40000` bytes less the 12-byte header) plus the
   * part of area 2 that ends at the native codeplug, at 27 bytes a record. Derived from the
   * layout in `integrations/radio-io/radios/radiofoundry/idDatabase.ts`, which has a test
   * pinning the two together.
   */
  ID_DATABASE_MAX: 287_629,
  PHYSICAL_CODEPLUG_BASE: 0x70_0000,
  IMAGE_END: 0x80_0000,
};

/** The DM-32UV RadioFoundry view used by profiles: firmware counts plus this board's power and ID database. */
export const DM32UV_RADIOFOUNDRY_LIMITS = {
  ...RADIOFOUNDRY_LIMITS,
  POWER_LEVELS: DM32UV_RADIOFOUNDRY_BOARD.POWER_LEVELS,
  ID_DATABASE_MAX: DM32UV_RADIOFOUNDRY_BOARD.ID_DATABASE_MAX,
} as const;
