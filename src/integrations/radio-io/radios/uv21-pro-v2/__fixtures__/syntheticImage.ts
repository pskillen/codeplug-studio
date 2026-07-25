/**
 * Synthetic UV-21Pro V2 clone image for directional tests.
 * See docs/reference/radios/baofeng/uv-21-pro-v2/fixtures.md — no personal dumps.
 */

import { UV21_PRO_V2_LAYOUT } from '../../uv17pro-family/layout.ts';

/** Allocate 0xFF-filled packed image of MEM_TOTAL. */
export function createBlankSyntheticImage(): Uint8Array {
  const image = new Uint8Array(UV21_PRO_V2_LAYOUT.memTotal);
  image.fill(0xff);
  return image;
}

export function writeFakeFirmware(image: Uint8Array, fw = 'UV21PROV2-TEST'): void {
  const bytes = new TextEncoder().encode(fw.slice(0, UV21_PRO_V2_LAYOUT.fwVerLen));
  image.fill(
    0xff,
    UV21_PRO_V2_LAYOUT.fwVerOffset,
    UV21_PRO_V2_LAYOUT.fwVerOffset + UV21_PRO_V2_LAYOUT.fwVerLen,
  );
  image.set(bytes, UV21_PRO_V2_LAYOUT.fwVerOffset);
}

/** Blank image with a fake firmware string at 0x1EF0. */
export function createSyntheticImageBase(): Uint8Array {
  const image = createBlankSyntheticImage();
  writeFakeFirmware(image);
  return image;
}
