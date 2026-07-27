/**
 * AT-D890UV flash erase-unit geometry (#768 phase 2).
 *
 * Measured erase unit: `0x40000` (256 kB), aligned — see
 * `docs/reference/radios/anytone/at-d890uv/memory-layout.md`.
 */

import {
  isAtD890ChannelDataAddress,
  isAtD890ChannelDataRealAddress,
} from './channelDataGeometry.ts';
import { RadioProtocolError } from '../../kit/errors.ts';

/** Measured flash erase granularity (hardware 2026-07-27). */
export const AT_D890_ERASE_UNIT_BYTES = 0x4_0000;

const ERASE_UNIT_MASK = ~(AT_D890_ERASE_UNIT_BYTES - 1);

/** Floor `address` to its containing erase-unit base. */
export function eraseUnitBaseFor(address: number): number {
  return address & ERASE_UNIT_MASK;
}

/** Unique ascending erase-unit bases touched by any of `addresses`. */
export function listTouchedEraseUnits(addresses: readonly number[]): number[] {
  const bases = new Set<number>();
  for (const address of addresses) {
    bases.add(eraseUnitBaseFor(address));
  }
  return [...bases].sort((a, b) => a - b);
}

export interface AtD890EraseUnitReadSpan {
  start: number;
  length: number;
}

/**
 * Span to fresh-read for one erase unit.
 *
 * ChannelData units must start in backed storage (not a mirrored upper half).
 */
export function readSpanForEraseUnit(unitBase: number): AtD890EraseUnitReadSpan {
  if (unitBase % AT_D890_ERASE_UNIT_BYTES !== 0) {
    throw new RadioProtocolError(
      `D890 erase unit base 0x${unitBase.toString(16)} is not ${AT_D890_ERASE_UNIT_BYTES}-byte aligned`,
    );
  }
  if (isAtD890ChannelDataAddress(unitBase) && !isAtD890ChannelDataRealAddress(unitBase)) {
    throw new RadioProtocolError(
      `D890 erase unit 0x${unitBase.toString(16)} starts in ChannelData mirrored storage`,
    );
  }
  return { start: unitBase, length: AT_D890_ERASE_UNIT_BYTES };
}

/** Fail when a staged address lies outside the touched erase-unit set. */
export function assertEraseUnitAddressInTouchedSet(
  address: number,
  touchedUnitBases: ReadonlySet<number>,
): void {
  const base = eraseUnitBaseFor(address);
  if (!touchedUnitBases.has(base)) {
    throw new RadioProtocolError(
      `D890 staged address 0x${address.toString(16)} is outside touched erase units (unit 0x${base.toString(16)})`,
    );
  }
}
