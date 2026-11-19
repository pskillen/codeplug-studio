/**
 * USB-serial chips of the programming cables used with the K-jack UART radios (DM-32UV, RT95, UV-5R Mini). The picker
 * lists every one, because the cable is whatever the operator bought. Identifies the cable, not the radio or its mode.
 * Radios with a built-in USB chip (for example the AT-D890UV) keep their own exact filter instead.
 */
import type { FirmwareLinkSpec } from './types.ts';

export const PROGRAMMING_CABLE_USB_FILTERS: FirmwareLinkSpec['usbFilters'] = [
  { usbVendorId: 0x067b, usbProductId: 0x2303 }, // Prolific PL2303
  { usbVendorId: 0x067b, usbProductId: 0x23a3 }, // Prolific PL2303GC
  { usbVendorId: 0x1a86, usbProductId: 0x7523 }, // WCH CH340
  { usbVendorId: 0x0403, usbProductId: 0x6001 }, // FTDI FT232R
];
