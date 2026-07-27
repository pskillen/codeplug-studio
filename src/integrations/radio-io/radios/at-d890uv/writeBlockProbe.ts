/**
 * AT-D890UV write block-size probe (#768).
 *
 * Reads are measured to honour 240-byte blocks. Writes are still 16 bytes per frame, and
 * whether the radio accepts more is untested — anytone-cps hardcodes 16 for writes, but it
 * hardcodes 16 for reads too and the radio happily served 240. At the measured rates that
 * single question is worth ~11 minutes per erase-unit RMW Write.
 *
 * Two passes with a radio power-cycle between them, because a write is staged into RAM and
 * only reaches flash on commit:
 *
 *   1. {@link buildAtD890WriteTrials} → write one payload per candidate size, then re-read
 *      each in the **same** session. That read answers a second open question: whether
 *      in-session reads see the staged shadow or the underlying flash — which decides how
 *      the Write verification in #769 has to work.
 *   2. After `END` + power-cycle, re-read the same addresses. Only that proves a size
 *      committed correctly.
 *
 * Payloads are self-describing and position-dependent, so a truncated, padded, or
 * misplaced write is detectable rather than silently passing.
 */

import { AT_D890_BLOCK_SIZE } from './constants.ts';
import { AT_D890_PROBE } from './eraseUnitProbe.ts';

/** Ascending. Trials stop at the first failure rather than pushing larger frames at a radio that just rejected one. */
export const AT_D890_WRITE_BLOCK_CANDIDATES = [0x10, 0x20, 0x40, 0x80, 0xf0] as const;

const WRITE_MAGIC = [0x44, 0x38, 0x39, 0x30, 0x57, 0x42, 0x4c, 0x4b] as const; // "D890WBLK"

/**
 * Trial addresses live in the last probe block's backed half, `0x800` off the sentinel grid
 * so they overwrite no sentinel, and `0x1000` apart so the largest payload cannot reach the
 * next trial.
 */
export const AT_D890_WRITE_PROBE_BASE =
  AT_D890_PROBE.SPAN_START + (AT_D890_PROBE.BLOCK_COUNT - 1) * AT_D890_PROBE.BLOCK_STRIDE + 0x800;

export const AT_D890_WRITE_PROBE_PITCH = 0x1000;

export function atD890WriteProbeAddress(index: number): number {
  return AT_D890_WRITE_PROBE_BASE + index * AT_D890_WRITE_PROBE_PITCH;
}

/**
 * Self-describing payload: magic, the address and length it was written with, then a
 * position-dependent tail. A short write, a zero-padded write, or a write that landed at
 * the wrong address all fail comparison rather than matching by luck.
 */
export function makeAtD890WritePayload(address: number, length: number): Uint8Array {
  const out = new Uint8Array(length);
  out.set(WRITE_MAGIC.slice(0, Math.min(WRITE_MAGIC.length, length)), 0);
  if (length > 11) {
    out[8] = (address >>> 24) & 0xff;
    out[9] = (address >>> 16) & 0xff;
    out[10] = (address >>> 8) & 0xff;
    out[11] = address & 0xff;
  }
  if (length > 12) out[12] = length & 0xff;
  for (let i = 16; i < length; i++) {
    out[i] = (address + i * 17 + length * 31) & 0xff;
  }
  return out;
}

export interface AtD890WriteTrial {
  blockSize: number;
  address: number;
  payload: Uint8Array;
}

/** One trial per candidate size, ascending. */
export function buildAtD890WriteTrials(): AtD890WriteTrial[] {
  return AT_D890_WRITE_BLOCK_CANDIDATES.map((blockSize, i) => {
    const address = atD890WriteProbeAddress(i);
    return { blockSize, address, payload: makeAtD890WritePayload(address, blockSize) };
  });
}

export type AtD890WriteOutcome = 'match' | 'mismatch' | 'erased' | 'refused';

export interface AtD890WriteTrialResult {
  blockSize: number;
  address: number;
  /** False when the radio did not ACK the frame at all. */
  accepted: boolean;
  /** Failure detail when `accepted` is false. */
  detail?: string;
  /** What a read of the same address returned. Absent when the write was refused. */
  readback?: AtD890WriteOutcome;
  /** Bytes that matched from the start of the payload — shows where a short write stopped. */
  matchingPrefix?: number;
}

export function classifyAtD890WriteReadback(
  address: number,
  blockSize: number,
  data: Uint8Array,
): { outcome: AtD890WriteOutcome; matchingPrefix: number } {
  const expected = makeAtD890WritePayload(address, blockSize);
  let matchingPrefix = 0;
  while (matchingPrefix < expected.length && data[matchingPrefix] === expected[matchingPrefix]) {
    matchingPrefix += 1;
  }
  if (matchingPrefix === expected.length) return { outcome: 'match', matchingPrefix };
  const allErased = data.length > 0 && data.every((b) => b === 0xff);
  return { outcome: allErased ? 'erased' : 'mismatch', matchingPrefix };
}

export interface AtD890WriteProbeVerdict {
  results: AtD890WriteTrialResult[];
  /** Largest size whose read-back matched byte for byte. */
  bestBlockSize: number;
  /** Throughput multiplier of `bestBlockSize` over 16-byte write frames. */
  speedup: number;
}

export function summariseAtD890WriteProbe(
  results: readonly AtD890WriteTrialResult[],
): AtD890WriteProbeVerdict {
  const good = results.filter((r) => r.accepted && r.readback === 'match');
  const bestBlockSize =
    good.length > 0 ? Math.max(...good.map((r) => r.blockSize)) : AT_D890_BLOCK_SIZE;
  return {
    results: [...results],
    bestBlockSize,
    // One frame carries `bestBlockSize` bytes where it used to carry 16, and per-frame
    // round-trip cost dominates, so the ratio is the throughput gain.
    speedup: bestBlockSize / AT_D890_BLOCK_SIZE,
  };
}
