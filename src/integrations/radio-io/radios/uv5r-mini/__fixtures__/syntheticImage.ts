/**
 * Synthetic UV-5R Mini clone image for directional tests.
 * See docs/reference/radios/baofeng/uv-5r-mini/fixtures.md — no personal dumps.
 */

import { UV5R_MINI_MEM_TOTAL } from '../constants.ts';

/** Allocate 0xFF-filled packed image of MEM_TOTAL. */
export function createBlankSyntheticImage(): Uint8Array {
  const image = new Uint8Array(UV5R_MINI_MEM_TOTAL);
  image.fill(0xff);
  return image;
}

/**
 * Base image for tests: blank. The UV-17Pro family has no firmware string in the clone image; CHIRP's
 * `_fw_ver_start` (`0x1EF0`) is channel data (slots 248 and 249).
 */
export function createSyntheticImageBase(): Uint8Array {
  return createBlankSyntheticImage();
}
