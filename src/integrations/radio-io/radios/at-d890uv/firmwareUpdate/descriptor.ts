/**
 * AT-D890UV firmware updater descriptor — registered in `firmware/registry.ts`, separate from the codeplug descriptor.
 */
import { AT_D890UV_STOCK_FIRMWARE } from '@core/radios/anytone/at-d890uv/firmware.ts';

import type { FirmwareUpdaterDescriptor } from '../../../firmware/types.ts';
import { AT_D890_FW_LINK } from './constants.ts';
import { createD890FirmwareUpdater } from './updater.ts';

export const AT_D890UV_FIRMWARE_UPDATER: FirmwareUpdaterDescriptor = {
  radioId: 'anytone-at-d890uv',
  label: AT_D890UV_STOCK_FIRMWARE.label,
  stock: AT_D890UV_STOCK_FIRMWARE,
  link: AT_D890_FW_LINK,
  createUpdater: () => createD890FirmwareUpdater(),
  capacitorSupported: false,
  // Cleared in its own commit after release 1.0.0 is flashed from Studio on hardware (#1364).
  prodFlashDisabled: true,
  // Set from the measured hardware flash when the prod flag is cleared.
  expectedDuration: 'a few minutes',
};
