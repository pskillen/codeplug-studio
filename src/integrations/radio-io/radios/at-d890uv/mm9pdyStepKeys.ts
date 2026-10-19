/**
 * MM9PDY AT-D890UV talk-group step keys.
 *
 * The codeplug byte is the firmware function index. Official CPS lists the same
 * functions one higher: item 15 Record is TG next, item 14 Record Switch is
 * TG previous. Offsets are short-press P1 (`+0x13`) and P2 (`+0x14`) inside
 * optional settings. The patch writes those two bytes only.
 */

import type { MemoryMap } from '../../types.ts';
import { RadioProtocolError } from '../../kit/errors.ts';
import { AT_D890_BLOCK_SIZE, D890_MAP } from './constants.ts';
import { eraseUnitBaseFor } from './eraseUnits.ts';

/** Firmware function index for TG next (CPS item 15 Record). */
export const MM9PDY_TG_NEXT_FUNCTION = 14;
/** Firmware function index for TG previous (CPS item 14 Record Switch). */
export const MM9PDY_TG_PREVIOUS_FUNCTION = 13;

/** Short-press P1, offset from {@link D890_MAP.OptionalSettingsMain}. */
export const AT_D890_P1_SHORT_OFFSET = 0x13;
/** Short-press P2, offset from {@link D890_MAP.OptionalSettingsMain}. */
export const AT_D890_P2_SHORT_OFFSET = 0x14;

/** 16-byte block that holds both short-press bytes. */
export function mm9pdyStepKeyBlockAddress(): number {
  return D890_MAP.OptionalSettingsMain + 0x10;
}

/** Patch the retained image. Neighbouring settings bytes, including `+0x200`, stay. */
export function patchMm9pdyStepKeysOnImage(image: MemoryMap): void {
  const address = mm9pdyStepKeyBlockAddress();
  const block = image.get(address, AT_D890_BLOCK_SIZE).slice();
  block[AT_D890_P1_SHORT_OFFSET - 0x10] = MM9PDY_TG_NEXT_FUNCTION;
  block[AT_D890_P2_SHORT_OFFSET - 0x10] = MM9PDY_TG_PREVIOUS_FUNCTION;
  image.set(address, block);
}

/**
 * Patch a fresh erase-unit buffer in place. Returns the 16-byte block address
 * that upload must treat as modelled so the preserved-byte check allows the
 * two changed bytes. The rest of the unit, including `+0x200`, stays as read.
 */
export function patchMm9pdyStepKeysOnEraseUnit(unitBase: number, unit: Uint8Array): number {
  const p1 = D890_MAP.OptionalSettingsMain + AT_D890_P1_SHORT_OFFSET;
  const p2 = D890_MAP.OptionalSettingsMain + AT_D890_P2_SHORT_OFFSET;
  if (eraseUnitBaseFor(p1) !== unitBase || eraseUnitBaseFor(p2) !== unitBase) {
    throw new RadioProtocolError(
      `MM9PDY step keys are not in erase unit 0x${unitBase.toString(16)}`,
    );
  }
  unit[p1 - unitBase] = MM9PDY_TG_NEXT_FUNCTION;
  unit[p2 - unitBase] = MM9PDY_TG_PREVIOUS_FUNCTION;
  return mm9pdyStepKeyBlockAddress();
}
