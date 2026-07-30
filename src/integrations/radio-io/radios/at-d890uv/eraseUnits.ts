/**
 * AT-D890UV flash erase-unit geometry (#768 phase 2).
 *
 * Measured erase unit: `0x40000` (256 kB), aligned — see
 * `docs/reference/radios/anytone/at-d890uv/memory-layout.md` and
 * `docs/reference/radios/anytone/at-d890uv/flash-sectors.md`.
 */

import {
  isAtD890ChannelDataAddress,
  isAtD890ChannelDataRealAddress,
} from './channelDataGeometry.ts';
import { RadioProtocolError } from '../../kit/errors.ts';

/** Measured flash erase granularity (hardware 2026-07-27). */
export const AT_D890_ERASE_UNIT_BYTES = 0x4_0000;

/**
 * Per erase-unit flash bookkeeping blocks (16-byte each) — sector-management markers,
 * not codeplug payload.
 *
 * ```
 * +0x3fbf0   ff ff ff ff 22 33 44 55 ff ff ff ff ff ff ff ff
 * +0x3fff0   ff ff ff ff ff ff ff ff ff ff ff ff 55 55 aa aa
 * ```
 *
 * // ⚠️ DO NOT REMOVE, AND DO NOT ADD A FLAG TO RE-ENABLE WRITING THESE.
 * // +0x3fbf0 and +0x3fff0 in every 0x40000 erase unit are the radio's own flash
 * // sector-management markers, not codeplug payload. The radio maintains them itself;
 * // the official Anytone CPS never writes them.
 * //
 * // fe6955e3's whole-unit RMW writeback swept them into our transmitted set. For three
 * // days every Studio write was ACKed, reached flash, and landed 0x40000 above the
 * // address we sent while the live bank kept its old contents — the radio was
 * // unprogrammable and the cause was invisible.
 * //
 * // Restoring these writes as a controlled experiment on 2026-07-30 made the radio
 * // display "Program error please initialise the radio!" and factory-reset itself,
 * // destroying the operator's configuration. Writing these addresses is not a
 * // diagnostic option. See docs/reference/radios/anytone/at-d890uv/flash-sectors.md
 */
export const AT_D890_ERASE_UNIT_BOOKKEEPING_BLOCK_OFFSETS = [0x3fbf0, 0x3fff0] as const;

const ERASE_UNIT_MASK = ~(AT_D890_ERASE_UNIT_BYTES - 1);

/** Floor `address` to its containing erase-unit base. */
export function eraseUnitBaseFor(address: number): number {
  return address & ERASE_UNIT_MASK;
}

/** True when `address` is a 16-byte bookkeeping block at the tail of an erase unit. */
export function isAtD890EraseUnitBookkeepingAddress(address: number): boolean {
  const offsetInUnit = address & (AT_D890_ERASE_UNIT_BYTES - 1);
  return AT_D890_ERASE_UNIT_BOOKKEEPING_BLOCK_OFFSETS.some((off) => off === offsetInUnit);
}

/**
 * Bookkeeping blocks excluded from verify compare when outside modelled banks.
 *
 * The same offsets can fall inside a declared region span (e.g. `TalkgroupData` at
 * `0x3a3fbf0`) and must still be compared there.
 */
export function isAtD890ExcludedBookkeepingStagingAddress(
  address: number,
  isOutsideModelledBanks: boolean,
): boolean {
  return isOutsideModelledBanks && isAtD890EraseUnitBookkeepingAddress(address);
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
