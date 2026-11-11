/**
 * UV-5R Mini firmware image hard interlocks. Code only: no setting, flag, environment value or patch field can
 * switch one off. Pure and synchronous; run by the updater's `checkImage` at Prepare and again at the start of
 * `flash()`. See DESIGN.md — Firmware flashing and docs/reference/radios/baofeng/uv-5r-mini/firmware.md.
 *
 *  - Target binding: radio id `baofeng-uv5rmini`, the package holds exactly the role `ufw`.
 *  - Provenance: the image has a build name (`versionStamp`) and is not the plain stock image.
 *  I1. The container parses: header CRC, list CRC, every entry's data CRC; exactly `flash.bin` (type 0) and
 *      `ota.bin` (type 100); entries inside the file (`parseUv5rMiniUfw`).
 *  I2. `ota.bin` holds exactly one entry, `uart_user.bin`, attribute 0x41, both CRCs good, and the SHA-256 of the
 *      packed loader is pinned.
 *  I3. `0x1000 + flash.bin.size` is at most the base's area end, and never past 0x94000.
 *  I4. Every `flash.bin` byte equals the stock image's byte at the same SoC address, except inside the base's app
 *      windows, and both have the same length. (The per-radio scramble is a keystream XOR by address, so equal stored
 *      bytes at an address are equal plain bytes; Studio never descrambles.)
 *  I7. The image's build name is not on the pinned list of its own loader: a re-flash or a late cut of an image its
 *      loader already lists would leave the radio looping in the loader.
 *
 * I5 (outgoing frames) and I6 (line control) belong to the session code, not to this file.
 */
import type { PreparedFirmwareImage } from '@core/services/firmware/prepareFirmwareImage.ts';

import { RadioInterlockError } from '../../../kit/errors.ts';
import {
  UV5RMINI_BASE,
  UV5RMINI_FLASH_BASE,
  UV5RMINI_FLASH_HARD_LIMIT,
  UV5RMINI_FW_RADIO_ID,
  UV5RMINI_FW_ROLE,
  UV5RMINI_PINNED_LOADERS,
  type PinnedLoader,
  type Uv5rMiniBase,
} from './constants.ts';
import { sha256HexSync } from './sha256Sync.ts';
import { parseUv5rMiniUfw, Uv5rMiniUfwError, type Uv5rMiniUfw } from './ufw.ts';

export { UV5RMINI_FW_RADIO_ID };

const hex = (n: number) => `0x${n.toString(16).toUpperCase()}`;

function parseOrRefuse(bytes: Uint8Array, what: string): Uv5rMiniUfw {
  try {
    return parseUv5rMiniUfw(bytes);
  } catch (e) {
    if (e instanceof Uv5rMiniUfwError) {
      throw new RadioInterlockError(
        `${what} is not a well-formed update file: ${e.message} Nothing was sent.`,
      );
    }
    throw e;
  }
}

/** First `flash.bin` offset outside every window where the two differ, or -1. */
export function firstDifferenceOutsideWindows(
  stock: Uint8Array,
  image: Uint8Array,
  base: Uv5rMiniBase,
): number {
  // Window edges as flash.bin offsets, sorted.
  const spans = base.windows
    .map(([s, e]) => [s - UV5RMINI_FLASH_BASE, e - UV5RMINI_FLASH_BASE] as const)
    .sort((a, b) => a[0] - b[0]);
  let from = 0;
  const scan = (start: number, end: number): number => {
    for (let i = start; i < end; i++) if (stock[i] !== image[i]) return i;
    return -1;
  };
  for (const [s, e] of spans) {
    const hit = scan(from, Math.min(Math.max(s, from), image.length));
    if (hit >= 0) return hit;
    from = Math.max(from, e);
  }
  return scan(from, image.length);
}

/**
 * Check a prepared image. Throws RadioInterlockError on the first failure; returns nothing.
 *
 * `pins` is a test-only seam: production callers never pass it, and nothing user-reachable may. The default is the
 * pinned table in constants.ts.
 */
export function checkUv5rMiniImage(
  image: PreparedFirmwareImage,
  pins: readonly PinnedLoader[] = UV5RMINI_PINNED_LOADERS,
): void {
  const base = UV5RMINI_BASE;

  // Target binding.
  if (image.radioId !== UV5RMINI_FW_RADIO_ID) {
    throw new RadioInterlockError(
      'This firmware is not for the Baofeng UV-5R Mini. Nothing was sent.',
    );
  }
  const roles = Object.keys(image.package.files);
  if (roles.length !== 1 || roles[0] !== UV5RMINI_FW_ROLE) {
    throw new RadioInterlockError(
      'The UV-5R Mini firmware must be exactly one .ufw file. Nothing was sent.',
    );
  }
  const ufwBytes = image.package.files[UV5RMINI_FW_ROLE]!;

  // Provenance: fail closed when Studio cannot tell what the image installs.
  if (image.provenance === 'stock' || !image.versionStamp) {
    throw new RadioInterlockError(
      "Studio can't tell which build this image installs, and the plain stock image is listed by its own loader. Use a release patch. Nothing was sent.",
    );
  }
  if (!image.stockPackage?.files[UV5RMINI_FW_ROLE]) {
    throw new RadioInterlockError(
      "The stock firmware this image was built from isn't available to check against. Nothing was sent.",
    );
  }

  // I1, I2: the container and its loader.
  const ufw = parseOrRefuse(ufwBytes, 'This image');
  const loaderSha = sha256HexSync(ufw.loader.packed);
  const pin = pins.find((p) => p.sha256 === loaderSha);
  if (!pin) {
    throw new RadioInterlockError("This image's loader is not one Studio knows: nothing was sent.");
  }

  // I3: the area.
  const flash = ufw.entries.flash.data;
  const end = UV5RMINI_FLASH_BASE + flash.length;
  if (end > UV5RMINI_FLASH_HARD_LIMIT) {
    throw new RadioInterlockError(
      `This image reaches ${hex(end)}, past the limit ${hex(UV5RMINI_FLASH_HARD_LIMIT)}. Nothing was sent.`,
    );
  }
  if (end > base.areaEnd) {
    throw new RadioInterlockError(
      `This image reaches ${hex(end)}, past the end of the firmware area ${hex(base.areaEnd)}. Nothing was sent.`,
    );
  }

  // I4: nothing but the app windows differs from the stock.
  const stockUfw = parseOrRefuse(image.stockPackage.files[UV5RMINI_FW_ROLE], 'The stock firmware');
  const stockFlash = stockUfw.entries.flash.data;
  if (stockFlash.length !== flash.length) {
    throw new RadioInterlockError(
      `This image is ${flash.length} bytes where the stock is ${stockFlash.length}. Nothing was sent.`,
    );
  }
  const diff = firstDifferenceOutsideWindows(stockFlash, flash, base);
  if (diff >= 0) {
    throw new RadioInterlockError(
      `This image changes the radio's flash at ${hex(UV5RMINI_FLASH_BASE + diff)}, outside the firmware's own area. Nothing was sent.`,
    );
  }

  // I7: unlisted self.
  if (pin.lists.includes(image.versionStamp)) {
    throw new RadioInterlockError(
      'This firmware is already listed by its own loader: flashing it could leave the radio stuck in update mode. Nothing was sent.',
    );
  }
}
