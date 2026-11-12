/**
 * RT95 safety-backup reader: the calibration region (0x3B00-0x3FFF) or the whole EEPROM, read with the
 * firmware project's rules (every 16-byte block twice, a third read for any block that differs).
 * Pure over `readBlock`; it never writes and knows no pipe.
 */
import { RadioProtocolError } from '../../../kit/errors.ts';
import { throwIfAborted } from '../../../kit/progress.ts';
import type { ProgressFn } from '../../../types.ts';

export type Rt95SafetyRegion = 'cal' | 'full';

export const RT95_SAFETY_BLOCK = 0x10;
export const RT95_SAFETY_CAL_START = 0x3b00;
export const RT95_SAFETY_CAL_END = 0x3fff;
export const RT95_SAFETY_FULL_START = 0x0000;
export const RT95_SAFETY_FULL_END = 0x7fff;
/** Where a 16 KiB part aliases the ident block. */
export const RT95_SAFETY_ALIAS_ADDR = 0x7b00;
export const RT95_SAFETY_SIGNATURE_ADDR = 0x3ff8;
export const RT95_SAFETY_SIGNATURE = 'AT778-UV';

export function rt95SafetyRegionRange(region: Rt95SafetyRegion): { start: number; end: number } {
  return region === 'cal'
    ? { start: RT95_SAFETY_CAL_START, end: RT95_SAFETY_CAL_END }
    : { start: RT95_SAFETY_FULL_START, end: RT95_SAFETY_FULL_END };
}

export interface ReadRt95SafetyRegionOptions {
  region: Rt95SafetyRegion;
  signal?: AbortSignal;
  onProgress?: ProgressFn;
}

export interface Rt95SafetyReadResult {
  bytes: Uint8Array;
  /** Block addresses that needed a third read. */
  rereads: number[];
}

function same(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function hex4(n: number): string {
  return `0x${n.toString(16).toUpperCase().padStart(4, '0')}`;
}

/** True when `bytes` (a region starting at `start`) holds the `AT778-UV` signature at 0x3FF8. */
export function rt95SafetySignatureOk(bytes: Uint8Array, start: number): boolean {
  const o = RT95_SAFETY_SIGNATURE_ADDR - start;
  if (o < 0 || o + RT95_SAFETY_SIGNATURE.length > bytes.length) return false;
  const sig = String.fromCharCode(...bytes.subarray(o, o + RT95_SAFETY_SIGNATURE.length));
  return sig === RT95_SAFETY_SIGNATURE;
}

export async function readRt95SafetyRegion(
  readBlock: (addr: number) => Promise<Uint8Array>,
  opts: ReadRt95SafetyRegionOptions,
): Promise<Rt95SafetyReadResult> {
  const { start, end } = rt95SafetyRegionRange(opts.region);
  const size = end - start + 1;
  const count = size / RT95_SAFETY_BLOCK;
  const total = count * 2;
  const passes: Uint8Array[] = [new Uint8Array(size), new Uint8Array(size)];
  let done = 0;
  for (let p = 0; p < 2; p++) {
    for (let i = 0; i < count; i++) {
      throwIfAborted(opts.signal);
      const addr = start + i * RT95_SAFETY_BLOCK;
      const block = await readBlock(addr);
      if (block.length !== RT95_SAFETY_BLOCK) {
        throw new RadioProtocolError(`Read of ${hex4(addr)} returned ${block.length} bytes.`);
      }
      passes[p]!.set(block, i * RT95_SAFETY_BLOCK);
      done++;
      opts.onProgress?.({
        cur: done,
        max: total,
        msg: `Reading pass ${p + 1} of 2 (${hex4(addr)})`,
      });
    }
  }

  const out = passes[0]!.slice();
  const rereads: number[] = [];
  for (let i = 0; i < count; i++) {
    const lo = i * RT95_SAFETY_BLOCK;
    const a = passes[0]!.subarray(lo, lo + RT95_SAFETY_BLOCK);
    const b = passes[1]!.subarray(lo, lo + RT95_SAFETY_BLOCK);
    if (same(a, b)) continue;
    throwIfAborted(opts.signal);
    const addr = start + lo;
    const c = await readBlock(addr);
    rereads.push(addr);
    if (same(c, a)) out.set(a, lo);
    else if (same(c, b)) out.set(b, lo);
    else {
      throw new RadioProtocolError(
        `Block ${hex4(addr)} differs on all three reads. Nothing was saved; check the cable and try again.`,
      );
    }
  }

  // The data must be trustworthy before it is offered as a backup.
  for (let a = RT95_SAFETY_CAL_START; a <= RT95_SAFETY_CAL_END; a += RT95_SAFETY_BLOCK) {
    const o = a - start;
    if (out.subarray(o, o + RT95_SAFETY_BLOCK).every((v) => v === 0)) {
      throw new RadioProtocolError(
        'The radio returned an empty block; nothing was saved, try again.',
      );
    }
  }
  const identOffset = RT95_SAFETY_CAL_START - start;
  const identBlock = out.subarray(identOffset, identOffset + RT95_SAFETY_BLOCK);
  let alias: Uint8Array;
  if (opts.region === 'full') {
    alias = out.subarray(RT95_SAFETY_ALIAS_ADDR, RT95_SAFETY_ALIAS_ADDR + RT95_SAFETY_BLOCK);
  } else {
    throwIfAborted(opts.signal);
    alias = await readBlock(RT95_SAFETY_ALIAS_ADDR);
  }
  if (same(identBlock, alias)) {
    throw new RadioProtocolError(
      "This radio's memory looks like a 16 KiB part (0x7B00 repeats 0x3B00). Nothing was saved.",
    );
  }
  if (!rt95SafetySignatureOk(out, start)) {
    throw new RadioProtocolError(
      `The calibration signature ${RT95_SAFETY_SIGNATURE} is missing at ${hex4(RT95_SAFETY_SIGNATURE_ADDR)}. The radio's memory is formatted or damaged; its calibration cannot be trusted. Do not flash.`,
    );
  }
  return { bytes: out, rereads };
}
