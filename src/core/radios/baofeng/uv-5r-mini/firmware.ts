/** Baofeng UV-5R Mini pinned stock and update-mode facts. */
import type { StockFirmwareDescriptor } from '../../../firmware/types.ts';
import { UV5RMINI_RADIO_LAYOUT_QUESTION } from './radioInfo.ts';

export const UV5RMINI_FIRMWARE_ROLE_UFW = 'ufw';

/** A release's two files, one per flash layout (the factory firmware's packing, not the board). */
export const UV5RMINI_RELEASE_LAYOUTS = ['L1', 'L2'] as const;

/**
 * The layout tag in an MM9PDY build name, `mm9pdy-<tag>-…`: `L1` (built on v0.04), `L2` (built on v0.27), or another
 * tag such as the retired `V4`, which is still parsed so that it can be refused: never a release file. Undefined for a
 * name with no tag: a to-stock patch (`nrfb-v0.04`) or an older build (`mm9pdy-0.1.0-rc.1`).
 */
export function uv5rMiniLayoutFromBuildName(buildName: string): string | undefined {
  return /^mm9pdy-([A-Z][0-9])-/.exec(buildName.trim())?.[1];
}

export const UV5RMINI_STOCK_FIRMWARE: StockFirmwareDescriptor = {
  radioId: 'baofeng-uv5rmini',
  label: 'Baofeng UV-5R Mini',
  version: 'v0.04 (NRFB)',
  baseName: 'nrfb-v0.04',
  stockSources: [
    {
      kind: 'own-image',
      label: "Your radio's own stock image",
      instructions:
        "Studio can't get this file for you. The firmware project builds it from a read of your radio.",
    },
  ],
  stockFlashOffered: false,
  stockReturn: {
    help: "Use the to-stock file (uv5rmini-fw-to-stock-….patch.json) from the firmware project's release artifact; Studio can't flash the plain stock file.",
  },
  members: [
    {
      role: UV5RMINI_FIRMWARE_ROLE_UFW,
      fileName: 'stock-nrfb-v0.04.ufw',
      size: 520192,
      sha256: '02419efb44081227faeccf1525bca0e6b0340c9d988ab80b2141c2ee48a7f74e',
    },
  ],
  // The second stock base: the vendor's v0.27 app. Its file carries no loader, by design; it is only ever a stock.
  alsoAccepts: [
    {
      version: 'v0.27 (NRF)',
      baseName: 'nrf-v0.27',
      members: [
        {
          role: UV5RMINI_FIRMWARE_ROLE_UFW,
          fileName: 'stock-nrf-v0.27.ufw',
          size: 504832,
          sha256: '811b4b37253e0685c7efbd3ff0a24aac2bcad223e5453d95b5bfc3f42c089128',
        },
      ],
    },
  ],
  // A release's L1 file is built on v0.04 and its L2 file on v0.27 (a radio's code base never changes), so both stocks
  // may be supplied at once and each file is prepared on its own.
  severalStocks: true,
  patchNames: ['baofeng-uv5rmini-firmware'],
  bootloaderEntry: {
    steps: [
      'Turn the radio off and plug in the cable.',
      'Hold PTT-A and =, then switch on.',
      'Release the keys when the computer icon and UPDATE... appear.',
    ],
    indicator: 'UPDATE... on the screen',
    warnings: [
      'If the red TX LED lights or the normal screen appears, switch off at once.',
      'If an earlier update was cut, switch on with no keys. The screen stays dark and Studio continues the write.',
    ],
  },
  stockVerifyHint: 'The radio boots to its normal screen.',
  radioLayout: UV5RMINI_RADIO_LAYOUT_QUESTION,
  releaseLayouts: {
    layouts: UV5RMINI_RELEASE_LAYOUTS,
    fromBuildName: uv5rMiniLayoutFromBuildName,
  },
};
