/** Baofeng UV-5R Mini pinned stock and update-mode facts. */
import type { StockFirmwareDescriptor, StockFirmwareSource } from '../../../firmware/types.ts';
import { UV5RMINI_RADIO_LAYOUT_QUESTION, uv5rMiniVariantOfBase } from './radioInfo.ts';

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

/**
 * Unofficial copies of the Mini's stock files, shared by a third party: Baofeng publishes no stock firmware for the
 * Mini. Studio only links to them (the host decrypts each file in the browser, so there is no direct URL to fetch) and
 * never downloads, hosts or mirrors them; the pinned hashes decide what is accepted. The only place these links live:
 * a dead link is a one-line change here.
 */
export const UV5RMINI_UNOFFICIAL_STOCK_COPIES = {
  host: 'mega.nz',
  copies: [
    {
      version: 'v0.27 (NRF)',
      fileName: 'stock-nrf-v0.27.ufw',
      url: 'https://mega.nz/file/U5NSDIhZ#DqRVur6RPVay1ylKZFQsz2zrXnR3ZrAMBToPHgPnPvQ',
    },
    {
      version: 'v0.04 (NRFB)',
      fileName: 'stock-nrfb-v0.04.ufw',
      url: 'https://mega.nz/file/NgFkWZTS#l4b9-Z6dSISLWBNc8OWMHYUfmzyFV_WT9f268APxnt0',
    },
  ],
} as const;

const UV5RMINI_STOCK_SOURCES: readonly StockFirmwareSource[] = [
  {
    kind: 'own-image',
    label: 'Your own copy',
    instructions:
      "If you already have the stock file for your radio's firmware, drop it below. Studio checks it against the pinned hash and refuses any other file.",
  },
  ...UV5RMINI_UNOFFICIAL_STOCK_COPIES.copies.map((c): StockFirmwareSource => ({
    kind: 'download',
    label: `Unofficial copy shared by a third party, stock ${c.version}`,
    url: c.url,
    host: UV5RMINI_UNOFFICIAL_STOCK_COPIES.host,
    official: false,
    fileName: c.fileName,
    note: 'Studio only links to it and never downloads it for you: save the file, then drop it below.',
  })),
];

export const UV5RMINI_STOCK_FIRMWARE: StockFirmwareDescriptor = {
  radioId: 'baofeng-uv5rmini',
  label: 'Baofeng UV-5R Mini',
  // The 1.0.0 release's stock (radios showing NRF, Firmware V0.27) is the primary; v0.04 (NRFB) is the second base.
  version: 'v0.27 (NRF)',
  // The radios the published releases are built for (1.0.0: v0.27 NRF only). Change it with the first release for
  // another stock base.
  supportedRadios:
    'UV-5R Minis whose Radio Info (MENU → Radio Info) shows Firmware V0.27 and Hardware V1.7, and whose start-up screen (hold 8 while switching on) shows 5RMINI NRF. Other Minis are not supported yet.',
  baseName: 'nrf-v0.27',
  stockSources: UV5RMINI_STOCK_SOURCES,
  stockFlashOffered: false,
  stockReturn: {
    help: "Use the to-stock file (uv5rmini-fw-to-stock-….patch.json) from the firmware project's release artifact; Studio can't flash the plain stock file.",
  },
  // The vendor's v0.27 app. Its file carries no loader, by design; it is only ever a stock.
  members: [
    {
      role: UV5RMINI_FIRMWARE_ROLE_UFW,
      fileName: 'stock-nrf-v0.27.ufw',
      size: 504832,
      sha256: '811b4b37253e0685c7efbd3ff0a24aac2bcad223e5453d95b5bfc3f42c089128',
    },
  ],
  // The second stock base: the vendor's v0.04 app.
  alsoAccepts: [
    {
      version: 'v0.04 (NRFB)',
      baseName: 'nrfb-v0.04',
      members: [
        {
          role: UV5RMINI_FIRMWARE_ROLE_UFW,
          fileName: 'stock-nrfb-v0.04.ufw',
          size: 520192,
          sha256: '02419efb44081227faeccf1525bca0e6b0340c9d988ab80b2141c2ee48a7f74e',
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
    variantOfBase: uv5rMiniVariantOfBase,
  },
};
