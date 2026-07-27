/**
 * Sparse erase-unit read-modify-write staging (#768 phase 2).
 *
 * Erasing flash sets bytes to `0xff`, so only non-`0xff` blocks need re-staging.
 */

import { AT_D890_BLOCK_SIZE } from './constants.ts';
import { AT_D890_ERASE_UNIT_BYTES, eraseUnitBaseFor } from './eraseUnits.ts';
import { RadioProtocolError } from '../../kit/errors.ts';

export interface AtD890StagingChunk {
  address: number;
  data: Uint8Array;
}

function isAllFf(data: Uint8Array): boolean {
  return data.every((b) => b === 0xff);
}

/** Apply 16-byte modelled writes onto a unit buffer (in place). */
export function overlayModelledChunksOntoUnit(
  unitBase: number,
  unitBuffer: Uint8Array,
  chunks: readonly AtD890StagingChunk[],
): void {
  for (const { address, data } of chunks) {
    if (eraseUnitBaseFor(address) !== unitBase) continue;
    const off = address - unitBase;
    if (off < 0 || off + data.length > unitBuffer.length) {
      throw new RadioProtocolError(
        `D890 modelled chunk 0x${address.toString(16)} overflows erase unit 0x${unitBase.toString(16)}`,
      );
    }
    unitBuffer.set(data, off);
  }
}

/**
 * List 16-byte staging frames from merged unit buffers, omitting all-`0xff` blocks.
 * Returns chunks in ascending address order.
 */
export function listSparseStagingChunks(
  unitBuffers: ReadonlyMap<number, Uint8Array>,
  modelledAddressSet: ReadonlySet<number>,
): AtD890StagingChunk[] {
  void modelledAddressSet;
  const out: AtD890StagingChunk[] = [];
  const unitBases = [...unitBuffers.keys()].sort((a, b) => a - b);
  for (const unitBase of unitBases) {
    const buffer = unitBuffers.get(unitBase)!;
    if (buffer.length !== AT_D890_ERASE_UNIT_BYTES) {
      throw new RadioProtocolError(
        `D890 unit buffer for 0x${unitBase.toString(16)} has length 0x${buffer.length.toString(16)}, expected 0x${AT_D890_ERASE_UNIT_BYTES.toString(16)}`,
      );
    }
    for (let off = 0; off < buffer.length; off += AT_D890_BLOCK_SIZE) {
      const chunk = buffer.subarray(off, off + AT_D890_BLOCK_SIZE);
      if (isAllFf(chunk)) continue;
      out.push({ address: unitBase + off, data: chunk.slice() });
    }
  }
  return out;
}

/**
 * Every staged block outside the modelled set must be byte-identical to the fresh read.
 */
export function assertPreservedBytesMatchFreshRead(
  stagingChunks: readonly AtD890StagingChunk[],
  freshUnitBuffers: ReadonlyMap<number, Uint8Array>,
  modelledAddressSet: ReadonlySet<number>,
): void {
  for (const { address, data } of stagingChunks) {
    if (modelledAddressSet.has(address)) continue;
    const unitBase = eraseUnitBaseFor(address);
    const fresh = freshUnitBuffers.get(unitBase);
    if (!fresh) {
      throw new RadioProtocolError(
        `D890 preserved-byte check missing fresh read for unit 0x${unitBase.toString(16)}`,
      );
    }
    const off = address - unitBase;
    for (let i = 0; i < data.length; i++) {
      if (data[i] !== fresh[off + i]) {
        throw new RadioProtocolError(
          `D890 preserved byte mismatch at 0x${(address + i).toString(16)}: staged 0x${data[i]!.toString(16)} !== fresh 0x${fresh[off + i]!.toString(16)}`,
        );
      }
    }
  }
}

/** Build a set of modelled write addresses from staging intent chunks. */
export function modelledAddressSetFromChunks(chunks: readonly AtD890StagingChunk[]): Set<number> {
  return new Set(chunks.map((c) => c.address));
}
