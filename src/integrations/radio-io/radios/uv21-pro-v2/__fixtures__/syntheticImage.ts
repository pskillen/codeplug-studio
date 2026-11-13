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

/**
 * Base image for tests: blank. The UV-17Pro family has no firmware string in the clone image; CHIRP's
 * `_fw_ver_start` (`0x1EF0`) is channel data (slots 248 and 249).
 */
export function createSyntheticImageBase(): Uint8Array {
  return createBlankSyntheticImage();
}
