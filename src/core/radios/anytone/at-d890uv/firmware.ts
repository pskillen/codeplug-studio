/**
 * AnyTone AT-D890UV pinned stock firmware and update-mode facts.
 * Code mirror of [firmware.md](../../../../docs/reference/radios/anytone/at-d890uv/firmware.md).
 * Used by the firmware flasher only — not library CRUD or codeplug Write.
 */
import type { StockFirmwareDescriptor } from '../../../firmware/types.ts';

/** Member roles of the three-file firmware package. */
export const AT_D890UV_FIRMWARE_ROLE = { CDD: 'cdd', CDI: 'cdi', SPI: 'spi' } as const;

export const AT_D890UV_STOCK_FIRMWARE: StockFirmwareDescriptor = {
  radioId: 'anytone-at-d890uv',
  label: 'AnyTone AT-D890UV',
  version: 'V1.05 (20260521)',
  stockSources: [
    {
      kind: 'download',
      label: 'Vendor download',
      official: true,
      url: 'https://anytoneusa.com/Files/D890UV%20V1.05%20DMR%20official%20release%20260521.zip',
      host: 'anytoneusa.com (12 Volt Power, US dealer)',
      note: 'About 44.5 MB: the zip also holds the ICON pack, which Studio does not use.',
    },
  ],
  zip: {
    fileName: 'D890UV V1.05 DMR official release 260521.zip',
    sha256: '193a4c24956a13094d3d529975d1f16077418d6527afaeb3de96c8628547f731',
  },
  members: [
    {
      role: AT_D890UV_FIRMWARE_ROLE.CDD,
      fileName: 'D890UV_V1.05_20260521.CDD',
      size: 1_675_272,
      sha256: '6d84926eecf309b25f68287d3521adaae2765f171db9d9f6a1358a454c71c96e',
    },
    {
      role: AT_D890UV_FIRMWARE_ROLE.CDI,
      fileName: 'D890UV_V1.05_20260521.CDI',
      size: 278,
      sha256: 'b24dd25aa02d0d72b6ba32b3b6c0d08d787f40248c80132cc4d5d7942c0470de',
    },
    {
      role: AT_D890UV_FIRMWARE_ROLE.SPI,
      fileName: 'D890UV_V1.05_20260521.spi',
      size: 51,
      sha256: '857771404d6ac1e38c9427ae1735007af0d174e27fc59fa1dfa1881560319c8a',
    },
  ],
  patchNames: ['anytone-d890-firmware'],
  bootloaderEntry: {
    steps: [
      'Switch the radio off. Check the battery is full.',
      'Hold PTT and PF3, and switch the radio on. Keep holding for 2 to 3 seconds.',
      'The red LED blinks and the screen stays blank. There is no sound.',
      'Plug the USB cable in.',
    ],
    indicator: 'Red LED blinking, screen blank',
    warnings: [
      'In update mode the radio appears on the computer exactly as in normal mode. The blinking red LED is the only sign.',
    ],
  },
  stockVerifyHint: 'Menu > Device Info > Version shows "Ver 1.05".',
};
