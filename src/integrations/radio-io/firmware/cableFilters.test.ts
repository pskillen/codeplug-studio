import { describe, expect, it } from 'vitest';

import { PROGRAMMING_CABLE_USB_FILTERS } from './cableFilters.ts';
import { DM32_FW_LINK } from '../radios/dm32uv/firmwareUpdate/constants.ts';
import { RT95_HEAD_FW_LINK } from '../radios/rt95/firmwareUpdate/constants.ts';
import { UV5RMINI_RADIO_REPORT_LINK } from '../radios/uv5r-mini/radioReportRead.ts';
import { UV5RMINI_FW_LINK } from '../radios/uv5r-mini/firmwareUpdate/constants.ts';

describe('programming cable USB filters', () => {
  it('lists CH340, FTDI FT232R and both Prolific PL2303 chips', () => {
    for (const f of [
      { usbVendorId: 0x1a86, usbProductId: 0x7523 },
      { usbVendorId: 0x0403, usbProductId: 0x6001 },
      { usbVendorId: 0x067b, usbProductId: 0x2303 },
      { usbVendorId: 0x067b, usbProductId: 0x23a3 },
    ]) {
      expect(PROGRAMMING_CABLE_USB_FILTERS).toContainEqual(f);
    }
  });

  it('is what every K-jack UART radio link uses', () => {
    for (const link of [
      DM32_FW_LINK,
      RT95_HEAD_FW_LINK,
      UV5RMINI_FW_LINK,
      UV5RMINI_RADIO_REPORT_LINK,
    ]) {
      expect(link.usbFilters).toBe(PROGRAMMING_CABLE_USB_FILTERS);
    }
  });
});
