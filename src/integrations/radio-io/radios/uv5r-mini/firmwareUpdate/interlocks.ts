/**
 * UV-5R Mini firmware image hard interlocks. Code only: no setting, flag, environment value or patch field can
 * switch one off. The one exception is the "already installed" warning at the end, which the operator passes with an
 * explicit confirm. Pure and synchronous; run by the updater's `checkImage` at Prepare and again at the start of
 * `flash()`. See DESIGN.md — Firmware flashing and docs/reference/radios/baofeng/uv-5r-mini/firmware.md.
 *
 *  - Target binding: radio id `baofeng-uv5rmini`, the package holds exactly the role `ufw`.
 *  - Provenance: the image has a build name (`versionStamp`) and is not the plain stock image.
 *  I1. The container parses: header CRC, list CRC, every entry's data CRC; exactly `flash.bin` (type 0) and
 *      `ota.bin` (type 100); entries inside the file (`parseUv5rMiniUfw`).
 *  I2. `ota.bin` holds exactly one entry, `uart_user.bin`, attribute 0x41, both CRCs good, and the SHA-256 of the
 *      packed loader is pinned.
 *  I3. `0x1000 + flash.bin.size` is at most the base's area end, and never past the base's own hard limit (the start
 *      of its first per-unit record sector: 0x94000 or 0x93000 by layout).
 *  Base. The patch's `base` names an entry in the base table, and the verified stock hashes to that entry's stock.
 *  I4. Every `flash.bin` byte equals the stock image's byte at the same SoC address, except inside the base's app
 *      windows, and both have the same length. (The per-radio scramble is a keystream XOR by address, so equal stored
 *      bytes at an address are equal plain bytes; Studio never descrambles.)
 *  Layout. When the pinned loader is a layout loader (`L1`, `L2`), the radio's layout is known
 *      (`PreparedFirmwareImage.radioLayout`) and is the loader's. The radio's stock "UPDATE..." stage loses settings on
 *      a crossed pick before the loader can refuse, so this is checked before anything is sent.
 *  To stock. An image whose build name is a base's own name (`nrfb-v0.04`, `nrf-v0.27`) puts the radio back to that
 *      stock: a to-stock image. Its build name is its own `base`; its loader is exactly that base's layout loader
 *      (never a list-carrying one); and I4 tightens to no difference from the stock flash at all, app windows
 *      included. Keyed on the build name, so a patch can't opt out by saying nothing.
 *  I7. For a list-carrying loader only: the image's build name is not on its loader's list (a re-flash or a late cut
 *      of an image its loader already lists would leave the radio looping in the loader). A layout loader has no
 *      list, so I7 does not apply to it. Keyed on the pin, never on the patch's descriptive `loader.list`.
 *  Already installed. Checked last, once every check above has passed. The radio already runs this image's build when
 *      the build name the radio gave in its radio report (`radioBuild`) is the image's own (ignoring case and
 *      surrounding spaces), or, for a to-stock image, when the radio's layout is known (`radioLayout` set) and it
 *      named no MM9PDY build. Studio can't read the installed app, so this is the only evidence there is.
 *      - A layout loader (`L1`, `L2`) always writes, so the image is allowed, but only once the operator has confirmed
 *        the warning (`reinstallConfirmed`): without it, `RadioConfirmRequiredError` and nothing is sent. This is the
 *        one check an operator can pass, and only with that explicit confirm.
 *      - A list-carrying loader writes nothing for the build it is given again, so it stays a refusal.
 *
 * I5 (outgoing frames) and I6 (line control) belong to the session code, not to this file.
 */
import type { PreparedFirmwareImage } from '@core/services/firmware/prepareFirmwareImage.ts';

import { RadioConfirmRequiredError, RadioInterlockError } from '../../../kit/errors.ts';
import {
  UV5RMINI_BASES,
  UV5RMINI_FLASH_BASE,
  UV5RMINI_FW_RADIO_ID,
  UV5RMINI_FW_ROLE,
  UV5RMINI_PINNED_LOADERS,
  UV5RMINI_RETIRED_LOADERS,
  type PinnedLoader,
  uv5rMiniHardLimit,
  type Uv5rMiniBase,
} from './constants.ts';
import { sha256HexSync } from './sha256Sync.ts';
import {
  parseUv5rMiniStockUfw,
  parseUv5rMiniUfw,
  Uv5rMiniUfwError,
  type Uv5rMiniStockUfw,
  type Uv5rMiniUfw,
} from './ufw.ts';

export { UV5RMINI_FW_RADIO_ID };

/** The flash log's word for a to-stock image. */
export const UV5RMINI_BACK_TO_STOCK = 'back to stock';

/** True when the image's build name is a known base's own name: it puts the radio back to that stock. */
export function isUv5rMiniToStockImage(
  image: Pick<PreparedFirmwareImage, 'versionStamp'>,
  bases: Readonly<Record<string, Uv5rMiniBase>> = UV5RMINI_BASES,
): boolean {
  return image.versionStamp !== undefined && Object.hasOwn(bases, image.versionStamp);
}

/** The refusal for an image whose loader is for the other layout than the radio's. */
export const UV5RMINI_OTHER_LAYOUT_REFUSAL =
  'This file is for the other flash layout; nothing was sent.';

/**
 * The refusal for an image on a list-carrying loader whose build is the one the radio says it already runs: that
 * loader would write nothing.
 */
export const UV5RMINI_ALREADY_INSTALLED_REFUSAL = (build: string): string =>
  `This radio already runs ${build}. This firmware is already installed; nothing was sent. Flash a different build.`;

/** The warning, confirmed before anything is sent, for an image whose build the radio already runs. */
export const UV5RMINI_REINSTALL_WARNING = (build: string): string =>
  `This radio already runs ${build}. Writing it again rewrites the same firmware; use this to repair a radio. The usual power-cut risk applies.`;

/**
 * The warning for a to-stock image when the radio names no MM9PDY build: the radio may be on that stock. The text
 * only says "may", because Studio doesn't compare the radio's stock version with the file's (an MM9PDY build from
 * before the radio report names no build either).
 */
export const UV5RMINI_REINSTALL_STOCK_WARNING = (stock: string): string =>
  `Studio sees no MM9PDY build on this radio, so it may already run the stock ${stock}. Writing it again rewrites the same firmware; use this to repair a radio. The usual power-cut risk applies.`;

/** The refusal for an image built with a retired loader. */
export const UV5RMINI_RETIRED_LOADER_REFUSAL =
  'This image was built with an older loader that Studio no longer sends. Use a newer build of this firmware. Nothing was sent.';

const hex = (n: number) => `0x${n.toString(16).toUpperCase()}`;

function parseOrRefuse(bytes: Uint8Array, what: string): Uv5rMiniUfw;
function parseOrRefuse(bytes: Uint8Array, what: string, stock: true): Uv5rMiniStockUfw;
function parseOrRefuse(bytes: Uint8Array, what: string, stock?: true): Uv5rMiniStockUfw {
  try {
    return stock ? parseUv5rMiniStockUfw(bytes) : parseUv5rMiniUfw(bytes);
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
 * `pins`, `bases` and `retired` are test-only seams: production callers never pass them, and nothing user-reachable
 * may. The defaults are the tables in constants.ts.
 */
export function checkUv5rMiniImage(
  image: PreparedFirmwareImage,
  pins: readonly PinnedLoader[] = UV5RMINI_PINNED_LOADERS,
  bases: Readonly<Record<string, Uv5rMiniBase>> = UV5RMINI_BASES,
  retired: readonly { readonly sha256: string }[] = UV5RMINI_RETIRED_LOADERS,
): void {
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

  // The base: named by the patch, and the stock it was built from must be that base's stock.
  const base = image.baseName === undefined ? undefined : bases[image.baseName];
  if (!base) {
    throw new RadioInterlockError(
      "This image's base is not one Studio knows, so its flash limits can't be checked. Nothing was sent.",
    );
  }
  if (sha256HexSync(image.stockPackage.files[UV5RMINI_FW_ROLE]) !== base.stockSha256) {
    throw new RadioInterlockError(
      `This image names the base ${base.name}, but the stock firmware it was built from is not that base's stock. Nothing was sent.`,
    );
  }

  // I1, I2: the container and its loader.
  const ufw = parseOrRefuse(ufwBytes, 'This image');
  const loaderSha = sha256HexSync(ufw.loader.packed);
  const pin = pins.find((p) => p.sha256 === loaderSha);
  if (!pin) {
    if (retired.some((r) => r.sha256 === loaderSha)) {
      throw new RadioInterlockError(UV5RMINI_RETIRED_LOADER_REFUSAL);
    }
    throw new RadioInterlockError("This image's loader is not one Studio knows: nothing was sent.");
  }

  // To stock: the stock it names, with exactly that stock's layout loader.
  const toStock = isUv5rMiniToStockImage(image, bases);
  if (toStock) {
    if (image.versionStamp !== base.name) {
      throw new RadioInterlockError(
        `This file puts back the stock ${image.versionStamp}, but it is built on ${base.name}. Nothing was sent.`,
      );
    }
    if (pin.layout === undefined) {
      throw new RadioInterlockError(
        'This to-stock file carries an older loader that lists builds. Use the to-stock file from a current firmware release. Nothing was sent.',
      );
    }
    if (pin.layout !== base.loaderLayout) {
      throw new RadioInterlockError(
        `This to-stock file for ${base.name} carries the ${pin.layout} loader, not that stock's ${base.loaderLayout} loader. Nothing was sent.`,
      );
    }
  }

  // Layout: a layout loader's image goes only to a radio of that layout, and only when Studio knows the radio's.
  if (pin.layout !== undefined) {
    if (image.radioLayout === undefined) {
      throw new RadioInterlockError(
        "Studio doesn't know this radio's flash layout, so it can't check this file is for it. Nothing was sent.",
      );
    }
    if (image.radioLayout !== pin.layout) {
      throw new RadioInterlockError(UV5RMINI_OTHER_LAYOUT_REFUSAL);
    }
  }

  // I3: the area.
  const flash = ufw.entries.flash.data;
  const end = UV5RMINI_FLASH_BASE + flash.length;
  const hardLimit = uv5rMiniHardLimit(base);
  if (end > hardLimit) {
    throw new RadioInterlockError(
      `This image reaches ${hex(end)}, past the limit ${hex(hardLimit)}. Nothing was sent.`,
    );
  }
  if (end > base.areaEnd) {
    throw new RadioInterlockError(
      `This image reaches ${hex(end)}, past the end of the firmware area ${hex(base.areaEnd)}. Nothing was sent.`,
    );
  }

  // I4: nothing but the app windows differs from the stock.
  const stockUfw = parseOrRefuse(
    image.stockPackage.files[UV5RMINI_FW_ROLE],
    'The stock firmware',
    true,
  );
  const stockFlash = stockUfw.entries.flash.data;
  if (stockFlash.length !== flash.length) {
    throw new RadioInterlockError(
      `This image is ${flash.length} bytes where the stock is ${stockFlash.length}. Nothing was sent.`,
    );
  }
  if (toStock) {
    const at = flash.findIndex((b, i) => b !== stockFlash[i]);
    if (at >= 0) {
      throw new RadioInterlockError(
        `This to-stock file changes the stock at ${hex(UV5RMINI_FLASH_BASE + at)}, so it would not put the stock back. Nothing was sent.`,
      );
    }
  }
  const diff = firstDifferenceOutsideWindows(stockFlash, flash, base);
  if (diff >= 0) {
    throw new RadioInterlockError(
      `This image changes the radio's flash at ${hex(UV5RMINI_FLASH_BASE + diff)}, outside the firmware's own area. Nothing was sent.`,
    );
  }

  // I7: unlisted self, for a loader that carries a list.
  if (pin.lists?.includes(image.versionStamp)) {
    throw new RadioInterlockError(
      'This firmware is already listed by its own loader: flashing it could leave the radio stuck in update mode. Nothing was sent.',
    );
  }

  // Already installed: last, so a hard refusal always wins over the warning.
  const typedIsImage =
    image.radioBuild !== undefined &&
    image.radioBuild.trim().toLowerCase() === image.versionStamp.toLowerCase();
  const stockOnStock = toStock && image.radioLayout !== undefined && image.radioBuild === undefined;
  if (!typedIsImage && !stockOnStock) return;
  if (pin.layout === undefined) {
    // A list-carrying loader plans nothing for the installed build: it would end with nothing written.
    throw new RadioInterlockError(UV5RMINI_ALREADY_INSTALLED_REFUSAL(image.versionStamp));
  }
  if (!image.reinstallConfirmed) {
    throw new RadioConfirmRequiredError(
      typedIsImage
        ? UV5RMINI_REINSTALL_WARNING(image.versionStamp)
        : UV5RMINI_REINSTALL_STOCK_WARNING(image.versionStamp),
    );
  }
}
