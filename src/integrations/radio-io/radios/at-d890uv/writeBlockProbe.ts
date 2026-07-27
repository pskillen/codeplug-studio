/**
 * AT-D890UV write block-size probe (#768).
 *
 * **Outcome: the question this answers turned out not to matter.** It was posed when the
 * erase-unit RMW design assumed *dense* staging — rewriting every byte of each touched
 * erase unit, 3.67 MB, which at 16-byte frames is ~12 minutes. But erasing sets `0xff`, so
 * a byte that already reads `0xff` needs no staging: only the 37.5 kB of non-`0xff` content
 * has to be re-sent. That is ~8 s at 16-byte frames, and matches how official CPS writes a
 * core codeplug in 10-20 s. Block size stops being a lever.
 *
 * Kept because it also measures in-session read semantics (#769), and because the desync
 * behaviour it uncovered is a standing hazard for anything that widens a frame.
 *
 * Hardware 2026-07-27: no size verified, **not even 16**, which is the known-good control —
 * so this run bounds nothing about block sizes. Oversized frames appear to disturb the
 * session enough that no staged write survives the commit.
 *
 * Reads are measured to honour 240-byte blocks. anytone-cps hardcodes 16 for writes, but it
 * hardcodes 16 for reads too and the radio happily served 240.
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

const WRITE_MAGIC = [0x44, 0x38, 0x39, 0x30, 0x42, 0x4c, 0x4b, 0x53] as const; // "D890BLKS"

/**
 * Bytes that begin a command: `R`, `W`, and the first letters of `PROGRAM` and `END`.
 *
 * Measured 2026-07-27: an oversized write frame **desyncs the radio**. It appears to consume
 * only `W + addr + len + 16 data + checksum` and then parse the remaining payload as fresh
 * commands. Any payload byte equal to a command opcode therefore risks synthesising a write
 * to an arbitrary address built from whatever bytes follow it.
 *
 * Excluding these from every payload byte makes an oversized frame's tail inert: the radio
 * may discard it, but it cannot be tricked into writing somewhere we did not choose.
 */
const COMMAND_OPCODE_BYTES = new Set([0x45, 0x50, 0x52, 0x57]);

/** Deterministic remap of a command byte to a safe one, so payloads stay reproducible. */
function toInertByte(byte: number): number {
  return COMMAND_OPCODE_BYTES.has(byte) ? (byte ^ 0x80) & 0xff : byte;
}

export function isAtD890InertPayload(data: Uint8Array): boolean {
  return data.every((b) => !COMMAND_OPCODE_BYTES.has(b));
}

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
  // No byte may look like a command: an oversized frame's tail can re-enter the radio's
  // parser, and a stray opcode there would write to an address we never chose.
  for (let i = 0; i < out.length; i++) out[i] = toInertByte(out[i]!);
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
  /**
   * Largest size whose read-back matched byte for byte, or the 16-byte default when none
   * did. Always read alongside {@link anyVerified} — on its own this value cannot tell
   * "16 bytes confirmed" apart from "nothing confirmed at all".
   */
  bestBlockSize: number;
  /** False when no size read back correctly, so the run proved nothing. */
  anyVerified: boolean;
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
    anyVerified: good.length > 0,
    // One frame carries `bestBlockSize` bytes where it used to carry 16, and per-frame
    // round-trip cost dominates, so the ratio is the throughput gain.
    speedup: bestBlockSize / AT_D890_BLOCK_SIZE,
  };
}
