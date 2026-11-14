/**
 * UV-5R Mini firmware updater descriptor, registered in `firmware/registry.ts`. Offered on prod since Studio flashed
 * patched builds to a Mini on hardware and the MM9PDY firmware's 1.0.0 (v0.27 base) was published (DESIGN.md — Firmware
 * flashing, rule 7).
 */
import { UV5RMINI_STOCK_FIRMWARE } from '@core/radios/baofeng/uv-5r-mini/firmware.ts';

import type { FirmwareRadioPreflight, FirmwareUpdaterDescriptor } from '../../../firmware/types.ts';
import {
  readUv5rMiniRadioReport,
  UV5RMINI_RADIO_REPORT_BAUD_FALLBACK,
  UV5RMINI_RADIO_REPORT_LINK,
} from '../radioReportRead.ts';
import { UV5RMINI_FW_LINK, UV5RMINI_FW_RADIO_ID } from './constants.ts';
import { createUv5rMiniFirmwareUpdater } from './updater.ts';

export const UV5RMINI_PREFLIGHT: FirmwareRadioPreflight = {
  attestations: [
    {
      id: 'battery-full',
      label: 'The battery is fully charged',
      help: 'A power cut in the last moment of the write can leave the radio needing a case-open repair.',
    },
    {
      id: 'dummy-load',
      label: 'A dummy load is fitted, or the radio is on low power',
      help: 'Nothing transmits during an update, but the radio must never be keyed with no antenna.',
    },
  ],
  updateModeConfirm:
    'The radio shows UPDATE..., or its screen stays dark after an interrupted update',
};

export const UV5RMINI_FIRMWARE_UPDATER: FirmwareUpdaterDescriptor = {
  radioId: UV5RMINI_FW_RADIO_ID,
  label: UV5RMINI_STOCK_FIRMWARE.label,
  stock: UV5RMINI_STOCK_FIRMWARE,
  link: UV5RMINI_FW_LINK,
  createUpdater: () => createUv5rMiniFirmwareUpdater(),
  capacitorSupported: false,
  // Cleared once Studio had flashed patched builds to a Mini on hardware and the MM9PDY firmware's 1.0.0 was published
  // (DESIGN.md — Firmware flashing, rule 7; #1654).
  prodFlashDisabled: false,
  preflight: UV5RMINI_PREFLIGHT,
  radioReport: {
    link: UV5RMINI_RADIO_REPORT_LINK,
    baudRateFallback: UV5RMINI_RADIO_REPORT_BAUD_FALLBACK,
    read: (pipe, opts) => readUv5rMiniRadioReport(pipe, opts),
  },
  expectedDuration: 'about 3 minutes',
};
