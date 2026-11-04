/**
 * Golden write-range kit (#1465): which EEPROM blocks an RT95 write path may ever send.
 *
 * Tests only. The allowed set lives here, once, so a future change has one place to argue with.
 * Sources are the firmware repo's CPS reference (findings F113 to F117 and F126: the stock CPS
 * write map and safety-range table). MM9PDY data lives only in 0x4000-0x5FFF, behind the chip-size
 * guard. No vendor bytes are quoted here.
 *
 * The constants deliberately repeat the numbers instead of importing `RT95_BLOCK_ADDR_END` or
 * `MMD1_BASE`: the kit is an independent oracle, and a test that imports the production limit
 * cannot notice the limit being widened. Do not turn these into imports.
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
 * The stock CPS Write set (F114, F115): 0x0000-0x329F in 16-byte blocks, except 0x30F0-0x31FF,
 * which the CPS skips. The CPS also skips the slots of channels absent from its document; Studio
 * writes all 200 slots, which stays inside this set.
 */
export const RT95_CPS_WRITE_RANGES: readonly Rt95AddressRange[] = [
  { start: 0x0000, end: 0x30ef },
  { start: 0x3200, end: 0x329f },
];

/**
 * The one named exception to the CPS set: the CPS never writes 0x30F0-0x31FF and MAIN never uses
 * it (F22), but Studio's stock upload is contiguous and writes it. The owner decided to keep that.
 * If that stops being true, delete this range and the test that pins it.
 */
export const RT95_STUDIO_EXTRA_WRITE_RANGE: Rt95AddressRange = { start: 0x30f0, end: 0x31ff };

/**
 * The MM9PDY data table: written on the MM9PDY target only, and only after the chip guard.
 * Everything from 0x6000 up, and 0x32A0-0x3FFF (ident at 0x3B00, factory calibration, the
 * `AT778-UV` signature at the top), is never written by any path (F113-F117, F126).
 */
export const RT95_MM9PDY_WRITE_RANGE: Rt95AddressRange = { start: 0x4000, end: 0x5fff };

export type Rt95WriteTarget = 'stock' | 'mm9pdy';

/**
 * The allowed set per target, as one constant: the CPS set plus the named Studio exception, and
 * on the MM9PDY target also the MM9PDY data table. The checker reads only this.
 */
export const RT95_GOLDEN_ALLOWED_WRITE_SET: Readonly<
  Record<Rt95WriteTarget, readonly Rt95AddressRange[]>
> = {
  stock: [...RT95_CPS_WRITE_RANGES, RT95_STUDIO_EXTRA_WRITE_RANGE],
  mm9pdy: [...RT95_CPS_WRITE_RANGES, RT95_STUDIO_EXTRA_WRITE_RANGE, RT95_MM9PDY_WRITE_RANGE],
};

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
    if (!RT95_GOLDEN_ALLOWED_WRITE_SET[target].some((r) => inRange(f.address, r))) {
      out.push(
        inRange(f.address, RT95_MM9PDY_WRITE_RANGE)
          ? `${at}: MM9PDY range on the ${target} target`
          : `${at}: outside the allowed write set`,
      );
    }
  }
  return out;
}
