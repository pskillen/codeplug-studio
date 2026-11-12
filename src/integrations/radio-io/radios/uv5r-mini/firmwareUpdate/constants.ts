/**
 * UV-5R Mini firmware updater constants: the `.ufw` container layout, the pinned loaders, the base table and the
 * area limits the image interlocks check. Source: the firmware project's patch-format page ("What Codeplug Studio
 * copies"); human mirror docs/reference/radios/baofeng/uv-5r-mini/firmware.md ("What Studio checks before flashing").
 * The page wins if the two differ.
 */
import { UV5RMINI_FIRMWARE_ROLE_UFW } from '@core/radios/baofeng/uv-5r-mini/firmware.ts';

import type { FirmwareLinkSpec } from '../../../firmware/types.ts';

export const UV5RMINI_FW_RADIO_ID = 'baofeng-uv5rmini' as const;
export const UV5RMINI_FW_ROLE = UV5RMINI_FIRMWARE_ROLE_UFW;

/** ENC: XOR with the low byte of a 16-bit key, stepped per byte; the key restarts per header and per entry. */
export const UFW_ENC_KEY = 0xffff;
export const UFW_ENC_POLY = 0x1021;

export const UFW_HEADER_SIZE = 0x40;
export const UFW_ENTRY_SIZE = 0x50;
export const UFW_ENTRY_NAME_OFFSET = 0x40;
export const UFW_ENTRY_NAME_LEN = 16;

export const UFW_TYPE_FLASH = 0;
export const UFW_TYPE_OTA = 100;
export const UFW_NAME_FLASH = 'flash.bin';
export const UFW_NAME_OTA = 'ota.bin';

/** `ota.bin` directory entry. */
export const OTA_ENTRY_SIZE = 0x20;
export const OTA_ENTRY_ATTR = 0x41;
export const OTA_LOADER_NAME = 'uart_user.bin';

/** `flash.bin[i]` is SoC flash address `UV5RMINI_FLASH_BASE + i`. */
export const UV5RMINI_FLASH_BASE = 0x1000;
/**
 * A stock base, keyed by the name a release patch gives in `base`. Windows, area end and the hard write limit are the
 * base's own, because the flash layout differs between bases. A base built on another by a small layout patch (a
 * derived base) is one more entry here: its `stockSha256` is the file it is built on, its windows add the layout
 * patch's own.
 */
export interface Uv5rMiniBase {
  readonly name: string;
  /** SHA-256 of the stock `.ufw` this base's images are built from. The verified stock must hash to it. */
  readonly stockSha256: string;
  /** Exclusive end of the area the image may occupy. */
  readonly areaEnd: number;
  /** SoC address windows, half-open, where the image may differ from the stock base. */
  readonly windows: readonly (readonly [start: number, end: number])[];
  readonly layout: {
    /** First SoC address of the first per-unit record sector. No image may reach it, whatever else the table says. */
    readonly recordSector: number;
  };
}

/** The hard write limit of a base: the start of its first per-unit record sector. */
export const uv5rMiniHardLimit = (base: Uv5rMiniBase): number => base.layout.recordSector;

/** The stock bases Studio accepts, by `base` name. `UV5RMINI_STOCK_FIRMWARE` pins the files. */
export const UV5RMINI_BASES: Readonly<Record<string, Uv5rMiniBase>> = {
  'nrfb-v0.04': {
    name: 'nrfb-v0.04',
    stockSha256: '02419efb44081227faeccf1525bca0e6b0340c9d988ab80b2141c2ee48a7f74e',
    areaEnd: 0x7c000,
    windows: [
      [0x4000, 0x4004],
      [0x4020, 0x4024],
      [0x4100, 0x7be1c],
    ],
    layout: { recordSector: 0x94000 },
  },
  'nrf-v0.27': {
    name: 'nrf-v0.27',
    stockSha256: '811b4b37253e0685c7efbd3ff0a24aac2bcad223e5453d95b5bfc3f42c089128',
    areaEnd: 0x7c000,
    windows: [
      [0x4000, 0x4004],
      [0x4020, 0x4024],
      [0x4100, 0x7bbc8],
    ],
    layout: { recordSector: 0x93000 },
  },
};

export interface PinnedLoader {
  readonly label: string;
  /** SHA-256 over the packed loader bytes. */
  readonly sha256: string;
  /** Build names the loader lists as installable. */
  readonly lists: readonly string[];
}

export const UV5RMINI_PINNED_LOADERS: readonly PinnedLoader[] = [
  {
    label: 'stock',
    sha256: '5382ce4d20dfc7a57cb2a86c836dbbe8c46f6f02625f6f91675df88066e9acb4',
    lists: ['nrfb-v0.04'],
  },
  {
    label: 'stock+c4',
    sha256: '87f53dec40c4335ec0c38734c7e3ee08af8847e795da15068f5c9ba876939867',
    lists: ['nrfb-v0.04', 'mm9pdy-0.1.0-rc.1'],
  },
  {
    label: 'stock+c4+w1',
    sha256: '3ec9a37db41f98bcf9e2b2a75200fd3450ac48807860470f5ca11b08a11724e8',
    lists: ['nrfb-v0.04', 'mm9pdy-0.1.0-rc.1', 'mm9pdy-pr125-g1c0a9df'],
  },
];

/** The updater's real-time waits, in milliseconds. Tests run them on fake timers. */
export const UV5RMINI_FW_TIMEOUT_MS = {
  /** Send nothing and listen: a loader restarted from its record talks first. */
  LISTEN: 2_000,
  /** Between pings while waiting for the app's pong. */
  PING_INTERVAL: 1_000,
  /** Give up pinging after this long. */
  PING_TOTAL: 30_000,
  /** After the first pong, soak up pongs answering earlier pings so none is mistaken for the hand-over. */
  PONG_SETTLE: 300,
  /** No frame at all, once the radio has answered (the loader erases first). */
  IDLE: 60_000,
  /** The longest single read, so an abort is noticed. */
  SLICE: 250,
} as const;

/**
 * The update link: the app's update stage runs at 9600 (the loader's 38400 is reached by `reopen`). DTR and RTS stay low
 * after every open and reopen. The filter names the CH340 cable, not the radio's mode.
 */
export const UV5RMINI_FW_LINK: FirmwareLinkSpec = {
  baudRate: 9600,
  usbFilters: [{ usbVendorId: 0x1a86, usbProductId: 0x7523 }],
  raiseDtrRts: false,
};
