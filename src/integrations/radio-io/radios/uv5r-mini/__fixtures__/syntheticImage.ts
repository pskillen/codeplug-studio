/**
 * Synthetic UV-5R Mini clone image for directional tests.
 * See docs/reference/radios/baofeng/uv-5r-mini/fixtures.md — no personal dumps.
 */

import { UV5R_MINI_FW_VER_OFFSET, UV5R_MINI_MEM_TOTAL } from '../constants.ts';

/** Allocate 0xFF-filled packed image of MEM_TOTAL. */
export function createBlankSyntheticImage(): Uint8Array {
  const image = new Uint8Array(UV5R_MINI_MEM_TOTAL);
  image.fill(0xff);
  return image;
}

export function writeFakeFirmware(image: Uint8Array, fw = 'UV5RMINI-TEST'): void {
  const bytes = new TextEncoder().encode(fw.slice(0, 24));
  image.fill(0xff, UV5R_MINI_FW_VER_OFFSET, UV5R_MINI_FW_VER_OFFSET + 24);
  image.set(bytes, UV5R_MINI_FW_VER_OFFSET);
}

/** Blank image with a fake firmware string at 0x1EF0. */
export function createSyntheticImageBase(): Uint8Array {
  const image = createBlankSyntheticImage();
  writeFakeFirmware(image);
  return image;
}
