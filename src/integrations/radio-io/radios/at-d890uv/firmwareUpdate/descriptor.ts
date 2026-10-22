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
  // Enabled in prod 2026-10-22: release 1.0.0 flashed from Studio on hardware (#1364).
  prodFlashDisabled: false,
  // Measured hardware flash of 1.0.0: about 25 s of transfer.
  expectedDuration: 'under a minute',
};
