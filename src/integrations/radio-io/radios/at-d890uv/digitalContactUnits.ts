/**
 * Which erase units belong to the digital contact database (#1406).
 *
 * The Write treats these units as Studio-owned: they start from `0xFF`, the packer's chunks are
 * overlaid, and no byte of them is read. Anything not on this list is never written by the
 * contact writer.
 */

import { D890_MAP } from './constants.ts';
import { AT_D890_ERASE_UNIT_BYTES } from './eraseUnits.ts';

/** Order-table banks the firmware accepts (`0x07080000 + k * 0x80000`, k = 0..15). */
const ORDER_UNIT_COUNT = 16;
/** Data banks the firmware boot check accepts (`0x07900000 + k * 0x80000`, k = 0..499). */
const DATA_UNIT_COUNT = 500;

/** True only for the A half of the meta unit and of each order and data bank. */
export function isAtD890DigitalContactUnit(unitBase: number): boolean {
  if (unitBase % AT_D890_ERASE_UNIT_BYTES !== 0) return false;
  if (unitBase === D890_MAP.DigitalContactMeta) return true;
  const inBanks = (start: number, stride: number, count: number): boolean => {
    const rel = unitBase - start;
    return rel >= 0 && rel % stride === 0 && rel / stride < count;
  };
  return (
    inBanks(
      D890_MAP.DigitalContactOrder,
      D890_MAP.DigitalContactOrderBlockStride,
      ORDER_UNIT_COUNT,
    ) || inBanks(D890_MAP.DigitalContactData, D890_MAP.DigitalContactDataStride, DATA_UNIT_COUNT)
  );
}
