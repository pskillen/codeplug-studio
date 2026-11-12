/**
 * RT95 firmware updater descriptors, registered in `firmware/registry.ts`, separate from the codeplug descriptor.
 * One firmware radio id and updater per MCU: the front panel (head) and the main board (MAIN), sharing protocol code
 * through a target profile (targets.ts).
 */
import {
  RT95_HEAD_STOCK_FIRMWARE,
  RT95_MAIN_STOCK_FIRMWARE,
} from '@core/radios/retevis/rt95/firmware.ts';

import type { FirmwareUpdaterDescriptor } from '../../../firmware/types.ts';
import { RT95_HEAD_FW_LINK } from './constants.ts';
import { RT95_HEAD_PREFLIGHT, RT95_MAIN_PREFLIGHT } from './preflight.ts';
import { RT95_MAIN_TARGET } from './targets.ts';
import { createRt95FirmwareUpdater, createRt95HeadFirmwareUpdater } from './updater.ts';

export const RT95_HEAD_FIRMWARE_UPDATER: FirmwareUpdaterDescriptor = {
  radioId: 'retevis-rt95-head',
  label: RT95_HEAD_STOCK_FIRMWARE.label,
  stock: RT95_HEAD_STOCK_FIRMWARE,
  link: RT95_HEAD_FW_LINK,
  createUpdater: () => createRt95HeadFirmwareUpdater(),
  capacitorSupported: false,
  // Hidden on prod until Studio has flashed a release to an RT95 on hardware (#1460).
  prodFlashDisabled: false,
  preflight: RT95_HEAD_PREFLIGHT,
  // Estimate from the vendor protocol (about 15 to 25 s for 104 frames); not yet measured.
  expectedDuration: 'under a minute',
};

/** MAIN is flashed through the head's bridge: the same link and frames, a different window and image rule. */
export const RT95_MAIN_FIRMWARE_UPDATER: FirmwareUpdaterDescriptor = {
  radioId: 'retevis-rt95-main',
  label: RT95_MAIN_STOCK_FIRMWARE.label,
  stock: RT95_MAIN_STOCK_FIRMWARE,
  link: RT95_HEAD_FW_LINK,
  createUpdater: () => createRt95FirmwareUpdater(RT95_MAIN_TARGET),
  capacitorSupported: false,
  // Hidden on prod until Studio has flashed a patched MAIN on hardware and the owner has decided on a calibration
  // restore path.
  prodFlashDisabled: true,
  preflight: RT95_MAIN_PREFLIGHT,
  // Estimate: about 90 ms into the head plus about 275 ms on to MAIN per frame, 55 frames; not yet measured.
  expectedDuration: 'under a minute',
};
