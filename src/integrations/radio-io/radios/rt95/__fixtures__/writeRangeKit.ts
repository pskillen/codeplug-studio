/**
 * Golden write-range kit (#1465): which EEPROM blocks an RT95 write path may ever send.
 *
 * Tests only. The allowed set lives here, once, so a future change has one place to argue with.
 * Sources are the firmware repo's CPS reference (findings F113 to F117 and F126: the stock CPS
 * write map and safety-range table) and its decisions D10 and D11 (MM9PDY data lives only in
 * 0x4000-0x5FFF, behind the chip-size guard). No vendor bytes are quoted here.
 */

import { PROGRAM_QX_WRITE_OPCODE } from '../../../kit/codecs/programQx.ts';
import type { FakeRt95Pipe } from './fakeRt95Pipe.ts';

export interface Rt95AddressRange {
  /** First byte address. */
  readonly start: number;
  /** Last byte address (inclusive). */
  readonly end: number;
}

/**
 * The stock CPS Write set (F113-F117, F126): every 16-byte block of 0x0000-0x329F, the last write
 * covering 0x3290-0x329F. The CPS also skips the slots of channels absent from its document;
 * Studio writes all 200 slots, which stays inside this range.
 */
export const RT95_CPS_WRITE_RANGE: Rt95AddressRange = { start: 0x0000, end: 0x329f };

/**
 * The one named exception inside the CPS range: the CPS never writes 0x30F0-0x31FF, MAIN never
 * uses it, and Studio writes it as part of its contiguous stock upload (owner decision D2 on
 * #1464). If that stops being true, delete this range and the test that pins it.
 */
export const RT95_STUDIO_EXTRA_WRITE_RANGE: Rt95AddressRange = { start: 0x30f0, end: 0x31ff };

/**
 * The MM9PDY data table (D10): written on the MM9PDY target only, and only after the chip guard.
 * Everything from 0x6000 up, and 0x32A0-0x3FFF (ident at 0x3B00, factory calibration, the
 * `AT778-UV` signature at the top), is never written by any path (F113-F117, F126).
 */
export const RT95_MM9PDY_WRITE_RANGE: Rt95AddressRange = { start: 0x4000, end: 0x5fff };

export type Rt95WriteTarget = 'stock' | 'mm9pdy';

export interface Rt95WriteFrame {
  readonly address: number;
  /** The length byte of the frame (data bytes). */
  readonly length: number;
  /** Whole frame length: opcode, address (2), length, data, checksum, terminator. */
  readonly frameBytes: number;
}

const inRange = (addr: number, r: Rt95AddressRange): boolean => addr >= r.start && addr <= r.end;

/** Every `W` frame the host put on the cable, in order. */
export function sentRt95WriteFrames(pipe: FakeRt95Pipe): Rt95WriteFrame[] {
  return pipe.writes
    .filter((w) => w[0] === PROGRAM_QX_WRITE_OPCODE)
    .map((w) => ({ address: (w[1]! << 8) | w[2]!, length: w[3]!, frameBytes: w.length }));
}

/** Reasons a set of sent frames breaks the golden range; empty when it is clean. */
export function rt95WriteRangeViolations(
  frames: readonly Rt95WriteFrame[],
  target: Rt95WriteTarget,
): string[] {
  const out: string[] = [];
  for (const f of frames) {
    const at = `0x${f.address.toString(16)}`;
    if (f.length !== 16 || f.frameBytes !== 4 + 16 + 2) out.push(`${at}: not a 16-byte write`);
    if (f.address % 16 !== 0) out.push(`${at}: not on a 16-byte boundary`);
    if (inRange(f.address, RT95_MM9PDY_WRITE_RANGE)) {
      if (target !== 'mm9pdy') out.push(`${at}: MM9PDY range on the ${target} target`);
    } else if (!inRange(f.address, RT95_CPS_WRITE_RANGE)) {
      out.push(`${at}: outside the CPS write set`);
    }
  }
  return out;
}
