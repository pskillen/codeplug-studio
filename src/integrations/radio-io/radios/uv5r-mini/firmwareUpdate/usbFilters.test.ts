import { describe, expect, it } from 'vitest';

import { UV5RMINI_RADIO_REPORT_LINK } from '../radioReportRead.ts';
import { UV5RMINI_FW_LINK, UV5RMINI_USB_FILTERS } from './constants.ts';

describe('UV-5R Mini port picker filters', () => {
  it('lists CH340 and FTDI FT232R cables', () => {
    expect(UV5RMINI_USB_FILTERS).toContainEqual({ usbVendorId: 0x1a86, usbProductId: 0x7523 });
    expect(UV5RMINI_USB_FILTERS).toContainEqual({ usbVendorId: 0x0403, usbProductId: 0x6001 });
  });

  it('uses the same list for the update and report-read links', () => {
    expect(UV5RMINI_FW_LINK.usbFilters).toBe(UV5RMINI_USB_FILTERS);
    expect(UV5RMINI_RADIO_REPORT_LINK.usbFilters).toBe(UV5RMINI_USB_FILTERS);
  });
});
