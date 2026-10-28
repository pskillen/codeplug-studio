/**
 * RT95 front panel firmware updater descriptor — registered in `firmware/registry.ts`, separate from the codeplug
 * descriptor. The main board (MAIN) is never offered.
 */
import { RT95_HEAD_STOCK_FIRMWARE } from '@core/radios/retevis/rt95/firmware.ts';

import type { FirmwareUpdaterDescriptor } from '../../../firmware/types.ts';
import { RT95_HEAD_FW_LINK } from './constants.ts';
import { RT95_HEAD_PREFLIGHT } from './preflight.ts';
import { createRt95HeadFirmwareUpdater } from './updater.ts';

export const RT95_HEAD_FIRMWARE_UPDATER: FirmwareUpdaterDescriptor = {
  radioId: 'retevis-rt95-head',
  label: RT95_HEAD_STOCK_FIRMWARE.label,
  stock: RT95_HEAD_STOCK_FIRMWARE,
  link: RT95_HEAD_FW_LINK,
  createUpdater: () => createRt95HeadFirmwareUpdater(),
  capacitorSupported: false,
  // Hidden on prod until Studio has flashed a release to an RT95 on hardware (#1460).
  prodFlashDisabled: true,
  preflight: RT95_HEAD_PREFLIGHT,
  // Estimate from the vendor protocol (about 15 to 25 s for 104 frames); not yet measured.
  expectedDuration: 'under a minute',
};
