/**
 * MM9PDY DM-32UV talk-group step keys.
 *
 * The firmware's independent talk groups step with key-function codes 20 and 21.
 * Official CPS calls them Previous Record and Next Record; the radio's own key
 * list shows TG Prev and TG Next. Short-press P1 and P2 are settings bytes
 * `0x8D` and `0x8F`. The patch writes those two bytes only.
 */

import type { MemoryMap } from '../../types.ts';
import type { Dm32ChannelDecodeContext } from './channelCodec.ts';
import { DM32_BLOCK_SIZE, DM32_METADATA } from './constants.ts';

/** Key-function code for TG previous (CPS "Previous Record"). */
export const MM9PDY_DM32_TG_PREVIOUS_FUNCTION = 20;
/** Key-function code for TG next (CPS "Next Record"). */
export const MM9PDY_DM32_TG_NEXT_FUNCTION = 21;

/** Short-press P1 in the settings block (metadata `0x04`). */
export const DM32_P1_SHORT_OFFSET = 0x8d;
/** Short-press P2 in the settings block (metadata `0x04`). */
export const DM32_P2_SHORT_OFFSET = 0x8f;

/** P1 short becomes TG previous and P2 short becomes TG next, as in the firmware's test setup. */
export function patchDm32Mm9pdyStepKeys(block: Uint8Array): void {
  block[DM32_P1_SHORT_OFFSET] = MM9PDY_DM32_TG_PREVIOUS_FUNCTION;
  block[DM32_P2_SHORT_OFFSET] = MM9PDY_DM32_TG_NEXT_FUNCTION;
}

/** Find the settings block and patch the step keys; no-op when the block is missing. */
export function encodeDm32Mm9pdyStepKeysIntoImage(
  image: MemoryMap,
  ctx: Dm32ChannelDecodeContext,
): MemoryMap {
  const hit = ctx.discovered.find((b) => b.metadata === DM32_METADATA.VFO_SETTINGS);
  if (!hit) return image;
  const mapOff = hit.address - ctx.addressBase;
  if (mapOff < 0 || mapOff + DM32_BLOCK_SIZE > image.size) return image;
  patchDm32Mm9pdyStepKeys(image.bytes.subarray(mapOff, mapOff + DM32_BLOCK_SIZE));
  return image;
}
