/**
 * DM-32UV firmware updater descriptor — registered in `firmware/registry.ts`, separate from the codeplug descriptor.
 */
import { DM32UV_STOCK_FIRMWARE } from '@core/radios/baofeng/dm-32uv/firmware.ts';

import type { FirmwareUpdaterDescriptor } from '../../../firmware/types.ts';
import { DM32_FW_LINK } from './constants.ts';
import { createDm32FirmwareUpdater } from './updater.ts';

export const DM32UV_FIRMWARE_UPDATER: FirmwareUpdaterDescriptor = {
  radioId: 'baofeng-dm32uv',
  label: DM32UV_STOCK_FIRMWARE.label,
  stock: DM32UV_STOCK_FIRMWARE,
  link: DM32_FW_LINK,
  createUpdater: () => createDm32FirmwareUpdater(),
  capacitorSupported: false,
  // Cleared in its own commit, after a patched release is flashed from Studio on hardware.
  prodFlashDisabled: true,
  expectedDuration: 'about 2 minutes (including a 13 s erase)',
};
