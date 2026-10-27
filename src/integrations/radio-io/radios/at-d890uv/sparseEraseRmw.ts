/**
 * Sparse erase-unit read-modify-write staging (#768 phase 2).
 *
 * Erasing flash sets bytes to `0xff`, so only non-`0xff` blocks need re-staging.
 */

import { AT_D890_BLOCK_SIZE } from './constants.ts';
import {
  AT_D890_ERASE_UNIT_BYTES,
  eraseUnitBaseFor,
  isAtD890EraseUnitBookkeepingAddress,
} from './eraseUnits.ts';
import { RadioProtocolError } from '../../kit/errors.ts';

export interface AtD890StagingChunk {
  address: number;
  data: Uint8Array;
}

function isAllFf(data: Uint8Array): boolean {
  return data.every((b) => b === 0xff);
}

/**
 * Lowest address per erase unit that a Write may send into, from the modelled chunks. Used to
 * erase a unit whose staged blocks are all `0xff` (see {@link listEraseOnlyChunks}).
 * `exclude` drops addresses the caller never transmits (family safe-skip, LocalInfo, ...);
 * flash bookkeeping blocks are always excluded.
 */
export function eraseAnchorsFromModelled(
  modelled: readonly AtD890StagingChunk[],
  exclude: (address: number) => boolean = () => false,
): Map<number, number> {
  const anchors = new Map<number, number>();
  for (const { address } of modelled) {
    if (isAtD890EraseUnitBookkeepingAddress(address) || exclude(address)) continue;
    const unit = eraseUnitBaseFor(address);
    const cur = anchors.get(unit);
    if (cur === undefined || address < cur) anchors.set(unit, address);
  }
  return anchors;
}

/**
 * A unit left pending by an earlier Write has to be entered again, or its stale half is promoted
 * by this session's `END`. When the staged blocks for such a unit are all `0xff` nothing would be
 * sent into it, so send one `0xff` block at the unit's anchor: the first `W` erases the half.
 */
export function listEraseOnlyChunks(
  units: readonly number[],
  sent: readonly AtD890StagingChunk[],
  anchors: ReadonlyMap<number, number>,
): AtD890StagingChunk[] {
  const entered = new Set(sent.map((c) => eraseUnitBaseFor(c.address)));
  const out: AtD890StagingChunk[] = [];
  for (const unit of units) {
    if (entered.has(unit)) continue;
    const address = anchors.get(unit);
    if (address === undefined) {
      throw new RadioProtocolError(
        `D890 unit 0x${unit.toString(16)} is pending from an earlier Write but this Write has no block it can send into it`,
      );
    }
    out.push({ address, data: new Uint8Array(AT_D890_BLOCK_SIZE).fill(0xff) });
  }
  return out.sort((a, b) => a.address - b.address);
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
 * List 16-byte staging frames from merged unit buffers, omitting all-`0xff` blocks
 * and erase-unit flash sector-management markers.
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
      const address = unitBase + off;
      // ⚠️ DO NOT REMOVE, AND DO NOT ADD A FLAG TO RE-ENABLE THIS.
      // +0x3fbf0 and +0x3fff0 in every 0x40000 erase unit are the radio's own flash
      // sector-management markers, not codeplug payload. The radio maintains them itself;
      // the official Anytone CPS never writes them.
      //
      // fe6955e3's whole-unit RMW writeback swept them into our transmitted set. For three
      // days every Studio write was ACKed, reached flash, and landed 0x40000 above the
      // address we sent while the live bank kept its old contents — the radio was
      // unprogrammable and the cause was invisible.
      //
      // Restoring these writes as a controlled experiment on 2026-07-30 made the radio
      // display "Program error please initialise the radio!" and factory-reset itself,
      // destroying the operator's configuration. Writing these addresses is not a
      // diagnostic option. See docs/reference/radios/anytone/at-d890uv/flash-sectors.md
      if (isAtD890EraseUnitBookkeepingAddress(address)) continue;
      const chunk = buffer.subarray(off, off + AT_D890_BLOCK_SIZE);
      if (isAllFf(chunk)) continue;
      out.push({ address, data: chunk.slice() });
    }
  }
  return out;
}

/**
 * Every staged block outside the modelled set must be byte-identical to the fresh read, except
 * for the bits a settings patch is allowed to change (`patchMasks`: byte address to mask).
 */
export function assertPreservedBytesMatchFreshRead(
  stagingChunks: readonly AtD890StagingChunk[],
  freshUnitBuffers: ReadonlyMap<number, Uint8Array>,
  modelledAddressSet: ReadonlySet<number>,
  patchMasks?: ReadonlyMap<number, number>,
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
      const allowed = patchMasks?.get(address + i) ?? 0;
      if (((data[i]! ^ fresh[off + i]!) & ~allowed & 0xff) !== 0) {
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

/** Extract live radio bytes at each staged address from fresh erase-unit reads (pre-overlay). */
export function preWriteChunksFromFreshUnits(
  chunks: readonly AtD890StagingChunk[],
  freshUnits: ReadonlyMap<number, Uint8Array>,
): AtD890StagingChunk[] {
  return chunks.map(({ address, data }) => ({
    address,
    data: readBytesFromEraseUnitBuffer(freshUnits, address, data.length),
  }));
}

function readBytesFromEraseUnitBuffer(
  freshUnits: ReadonlyMap<number, Uint8Array>,
  address: number,
  length: number,
): Uint8Array {
  const unitBase = eraseUnitBaseFor(address);
  const buffer = freshUnits.get(unitBase);
  if (!buffer) {
    throw new RadioProtocolError(
      `D890 pre-write read missing fresh erase unit 0x${unitBase.toString(16)} for 0x${address.toString(16)}`,
    );
  }
  const off = address - unitBase;
  if (off < 0 || off + length > buffer.length) {
    throw new RadioProtocolError(
      `D890 pre-write read 0x${address.toString(16)}+0x${length.toString(16)} overflows unit 0x${unitBase.toString(16)}`,
    );
  }
  return buffer.subarray(off, off + length).slice();
}
