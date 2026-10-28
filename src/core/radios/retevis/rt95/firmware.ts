/**
 * Retevis RT95 front panel (LCD / "head") pinned stock firmware and update-mode facts.
 * Code mirror of [firmware.md](../../../../../docs/reference/radios/retevis/rt95/firmware.md).
 * Used by the firmware flasher only — not library CRUD or codeplug Write. The main board (MAIN) is never offered.
 */
import type { StockFirmwareDescriptor } from '../../../firmware/types.ts';

/** Member roles of the three-file firmware package. */
export const RT95_HEAD_FIRMWARE_ROLE = { CDD: 'cdd', CDI: 'cdi', SPI: 'spi' } as const;

export const RT95_HEAD_STOCK_FIRMWARE: StockFirmwareDescriptor = {
  radioId: 'retevis-rt95-head',
  label: 'Retevis RT95 front panel (LCD)',
  version: 'LCD V1.41 (20231202)',
  stockSources: [
    {
      kind: 'ask-vendor',
      label: 'Email Retevis support',
      instructions:
        'Ask for the RT95 mic-gain update package (2024). It holds the front panel LCD V1.41 and main board ' +
        'MAIN V1.61 files; Retevis sends it on request. Contact Retevis through',
      contact: {
        text: 'the Retevis contact page',
        href: 'https://www.retevis.com/pages/contactus',
      },
    },
    {
      kind: 'download',
      label: 'Unofficial mirror',
      url: 'http://47.253.5.16/soft/RT95%20Upgrade%20software-Microphone%20gain%20adjustment.zip',
      host: '47.253.5.16 (unofficial mirror, plain HTTP)',
      official: false,
      note:
        'About 6 MB. Your browser may warn that the download is not secure (plain HTTP). Studio checks every file ' +
        'against the pinned hashes.',
    },
  ],
  zip: {
    fileName: 'RT95 Upgrade software-Microphone gain adjustment.zip',
    sha256: '4cbddc96bce718a9990137f3a83cb21dafb78101f0204ebd4fb41da6b8241089',
  },
  members: [
    {
      role: RT95_HEAD_FIRMWARE_ROLE.CDD,
      fileName: 'RT95_LCD(NG)_V1.41_20231202.CDD',
      size: 105_628,
      sha256: '50c00fc44b3122e54e9e6ea7273519df1b1d05f136d5313120e10d7eb5b03b84',
    },
    {
      role: RT95_HEAD_FIRMWARE_ROLE.CDI,
      fileName: 'RT95_LCD(NG)_V1.41_20231202.CDI',
      size: 278,
      sha256: 'a8970f8d6327630569426936465fa40a6734fa0cf91d2f84d21354e7b5ad2b4a',
    },
    {
      role: RT95_HEAD_FIRMWARE_ROLE.SPI,
      fileName: 'RT95_LCD(NG)_V1.41_20231202.spi',
      size: 10,
      sha256: '29f97d17af27624d43ed192dc54ed36ed41b852f684a4fc16391e483fbf90164',
    },
  ],
  patchNames: ['retevis-rt95-firmware'],
  bootloaderEntry: {
    steps: [
      "Take a backup with Studio's Read first.",
      'Switch the radio off.',
      'Hold P1 and press and hold the channel knob, then switch the radio on.',
      'The screen stays blank: that is update mode.',
      'Connect the programming cable.',
    ],
    indicator: 'Blank screen',
    warnings: [
      'If the screen shows UPDATE THE RF CPU you pressed P3: switch off and start again. That mode updates the main board.',
      'Never flash this to a radio with a serial number before 2101.',
    ],
  },
  stockVerifyHint:
    'Hold FUNC + P4 while switching on: the test screen shows LCD CPU: V1.11. Turn the knob only, then switch off.',
};
