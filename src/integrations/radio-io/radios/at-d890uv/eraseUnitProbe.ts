/**
 * AT-D890UV flash erase-unit probe (#768 phase 1).
 *
 * The radio erases a whole flash unit when any 16-byte block inside it is written,
 * so bytes not rewritten in the same session come back `0xff`. This module measures
 * that unit's size and alignment without guessing.
 *
 * Method — paint a grid of 16-byte sentinels across an unused span, commit, then in a
 * *separate* session write one marker inside the span and commit again. The sentinels
 * that come back erased delimit exactly one erase unit.
 *
 * Sampling every {@link AT_D890_PROBE.SENTINEL_STRIDE} bytes is exact rather than
 * approximate: erase units are powers of two no smaller than the stride, so their
 * boundaries always land on the sentinel grid.
 */

import { AT_D890_BLOCK_SIZE } from './constants.ts';
import { RadioProtocolError } from '../../kit/errors.ts';

/**
 * Probe geometry — chosen to bound the blast radius, since the erase unit is the very
 * thing being measured and could be larger than expected.
 *
 * The span sits in `ChannelData` blocks 16-18, deep inside the bank and far above the
 * blocks any realistic codeplug occupies (block 0-1 covers the first 256 channels).
 * Consequences if the unit turns out far bigger than assumed:
 *
 * | Erase unit | Blast radius | Impact |
 * | ---------- | ------------ | ------ |
 * | ≤ `0x100000` | inside the span | none — unused address space |
 * | `0x400000` (4 MB, largest real NAND block) | `0x1800000-0x1c00000` | none — still unused |
 * | `0x800000` | `0x1800000-0x2000000` | none — still above real channels |
 * | `0x1000000` | all of `ChannelData` | wipes real channels; CPS-recoverable |
 *
 * No flash part has an erase granularity above a few MB, so the realistic worst case is
 * the third row. Placing the span low (e.g. block 2) would instead put real channels in
 * the blast for any unit ≥ `0x200000`, which is entirely plausible — hence blocks 16-18.
 */
export const AT_D890_PROBE = {
  /** Channel block 16 (`0x1000000 + 16 * 0x80000`). */
  SPAN_START: 0x180_0000,
  /** Channel block 19 — exclusive. */
  SPAN_END: 0x198_0000,
  /** `ChannelData` block pitch. */
  BLOCK_STRIDE: 0x8_0000,
  /**
   * Real storage per block. Measured on hardware 2026-07-27: writes `0x40000` above an
   * address land on that address, so only the low half of each block is backed and the
   * upper half mirrors it. Sentinels must stay below this offset or they overwrite
   * each other.
   */
  REAL_BYTES_PER_BLOCK: 0x4_0000,
  /** Blocks the grid covers, so an erase unit larger than one block's real half is visible. */
  BLOCK_COUNT: 3,
  /** Sentinel pitch, and therefore the measurement resolution. */
  SENTINEL_STRIDE: 0x2000,
  /**
   * Marker address for pass 2 — mid-way through the middle block's real half, so an erase
   * unit up to that half's size is bracketed on both sides. Deliberately off the sentinel
   * grid so it destroys no sentinel of its own, and past the `0x4000` its block would use
   * for channel records.
   */
  MARKER_ADDRESS: 0x18a_0800,
  /** Channel slots whose records fall inside the span — must be unoccupied before writing. */
  FIRST_CHANNEL_SLOT: 2048,
  LAST_CHANNEL_SLOT: 2431,
} as const;

const SENTINEL_MAGIC = [0x44, 0x38, 0x39, 0x30, 0x50, 0x52, 0x42, 0x45] as const; // "D890PRBE"
const MARKER_MAGIC = [0x44, 0x38, 0x39, 0x30, 0x4d, 0x41, 0x52, 0x4b] as const; // "D890MARK"

export interface AtD890ProbeBlock {
  address: number;
  data: Uint8Array;
}

function taggedBlock(magic: readonly number[], address: number): Uint8Array {
  const out = new Uint8Array(AT_D890_BLOCK_SIZE);
  out.set(magic, 0);
  // Self-describing: a block read back at the wrong address is obvious rather than silent.
  out[8] = (address >>> 24) & 0xff;
  out[9] = (address >>> 16) & 0xff;
  out[10] = (address >>> 8) & 0xff;
  out[11] = address & 0xff;
  out[12] = 0x00;
  out[13] = 0x00;
  out[14] = 0x00;
  out[15] = 0x00;
  return out;
}

export function makeAtD890ProbeSentinel(address: number): Uint8Array {
  return taggedBlock(SENTINEL_MAGIC, address);
}

export function makeAtD890ProbeMarker(address: number): Uint8Array {
  return taggedBlock(MARKER_MAGIC, address);
}

/**
 * Every sentinel the paint pass writes, ascending.
 *
 * Only the **real** low half of each block is sampled. The upper half mirrors it, so
 * painting there would silently overwrite the low-half sentinels — which is exactly what
 * invalidated the first hardware run.
 */
export function listAtD890ProbeSentinels(): AtD890ProbeBlock[] {
  const out: AtD890ProbeBlock[] = [];
  for (let block = 0; block < AT_D890_PROBE.BLOCK_COUNT; block++) {
    const base = AT_D890_PROBE.SPAN_START + block * AT_D890_PROBE.BLOCK_STRIDE;
    for (
      let offset = 0;
      offset < AT_D890_PROBE.REAL_BYTES_PER_BLOCK;
      offset += AT_D890_PROBE.SENTINEL_STRIDE
    ) {
      const address = base + offset;
      out.push({ address, data: makeAtD890ProbeSentinel(address) });
    }
  }
  return out;
}

/** True when `address` lies in backed storage rather than a block's mirrored upper half. */
export function isAtD890RealAddress(address: number): boolean {
  const offsetInBlock = (address - AT_D890_PROBE.SPAN_START) % AT_D890_PROBE.BLOCK_STRIDE;
  return offsetInBlock >= 0 && offsetInBlock < AT_D890_PROBE.REAL_BYTES_PER_BLOCK;
}

export type AtD890SentinelState = 'intact' | 'erased' | 'unexpected';

export function classifyAtD890Sentinel(address: number, data: Uint8Array): AtD890SentinelState {
  if (data.every((b) => b === 0xff)) return 'erased';
  const expected = makeAtD890ProbeSentinel(address);
  return data.every((b, i) => b === expected[i]) ? 'intact' : 'unexpected';
}

/**
 * Recover the address a probe block was *written* to, whatever address it was read back from.
 * Returns `null` for erased flash or bytes this probe did not write.
 *
 * A cell whose tag differs from the address it was read at proves the address space is not
 * flat — two addresses map to one physical cell.
 */
export function readAtD890ProbeTag(data: Uint8Array): number | null {
  if (data.length < AT_D890_BLOCK_SIZE) return null;
  const isSentinel = SENTINEL_MAGIC.every((b, i) => data[i] === b);
  const isMarker = MARKER_MAGIC.every((b, i) => data[i] === b);
  if (!isSentinel && !isMarker) return null;
  return ((data[8]! << 24) | (data[9]! << 16) | (data[10]! << 8) | data[11]!) >>> 0;
}

export interface AtD890SentinelReading {
  address: number;
  state: AtD890SentinelState;
  /** Address stamped into the block actually found here, when it is one of ours. */
  tag?: number;
}

export interface AtD890AliasVerdict {
  /** Cells whose contents were written to a different address. */
  aliasedCells: number;
  /** `tag - address` for every aliased cell, most common first. */
  deltas: { delta: number; count: number }[];
  /**
   * Single consistent alias distance, when every aliased cell shares one delta.
   * The address space then repeats with this period — writes `delta` above an address
   * land on it.
   */
  aliasStride: number | null;
  /** True when no cell reported contents from another address. */
  flat: boolean;
}

/**
 * Diagnose a non-flat address space from a painted grid.
 *
 * Pass 1 writes a self-describing block to every grid address. If the space were flat every
 * cell would read back its own tag. Any cell reporting a different tag identifies two
 * addresses sharing one physical cell, and the delta is the aliasing period.
 */
export function inferAtD890Aliasing(
  readings: readonly AtD890SentinelReading[],
): AtD890AliasVerdict {
  const counts = new Map<number, number>();
  let aliasedCells = 0;
  for (const r of readings) {
    if (r.tag == null || r.tag === r.address) continue;
    aliasedCells += 1;
    const delta = r.tag - r.address;
    counts.set(delta, (counts.get(delta) ?? 0) + 1);
  }
  const deltas = [...counts.entries()]
    .map(([delta, count]) => ({ delta, count }))
    .sort((a, b) => b.count - a.count);
  return {
    aliasedCells,
    deltas,
    aliasStride: deltas.length === 1 ? Math.abs(deltas[0]!.delta) : null,
    flat: aliasedCells === 0,
  };
}

/**
 * Refuse to write unless every channel slot covered by the probe span is vacant.
 * `channelSet` is the raw `0x200`-byte bitmap read from `D890_MAP.ChannelSet`.
 */
export function assertAtD890ProbeSpanUnused(channelSet: Uint8Array): void {
  const occupied: number[] = [];
  for (
    let slot = AT_D890_PROBE.FIRST_CHANNEL_SLOT;
    slot <= AT_D890_PROBE.LAST_CHANNEL_SLOT;
    slot++
  ) {
    const byte = channelSet[slot >> 3];
    if (byte != null && (byte & (1 << (slot % 8))) !== 0) occupied.push(slot);
  }
  if (occupied.length > 0) {
    throw new RadioProtocolError(
      `D890 erase probe refused — channel slots ${occupied.slice(0, 8).join(', ')}` +
        `${occupied.length > 8 ? ` (+${occupied.length - 8} more)` : ''} are occupied inside the ` +
        `probe span 0x${AT_D890_PROBE.SPAN_START.toString(16)}-0x${AT_D890_PROBE.SPAN_END.toString(16)}. ` +
        `Pick a different span before probing.`,
    );
  }
}

export interface AtD890PaintVerdict {
  intact: number;
  erased: number;
  unexpected: number;
  /** False when same-session writes did not survive together — a finding in its own right. */
  ok: boolean;
}

/** Pass-1 control: after a commit + power-cycle, every painted sentinel must still be there. */
export function verifyAtD890Paint(readings: readonly AtD890SentinelReading[]): AtD890PaintVerdict {
  let intact = 0;
  let erased = 0;
  let unexpected = 0;
  for (const r of readings) {
    if (r.state === 'intact') intact += 1;
    else if (r.state === 'erased') erased += 1;
    else unexpected += 1;
  }
  return { intact, erased, unexpected, ok: erased === 0 && unexpected === 0 };
}

export interface AtD890EraseUnitResult {
  /** First address of the erased run — the erase unit's base. */
  unitStart: number;
  /** Exclusive end of the erased run. */
  unitEnd: number;
  /**
   * Backed bytes erased: erased cells × stride. This is the physical erase size.
   * Prefer it over `unitEnd - unitStart`, which counts the unbacked mirror halves the
   * grid skips whenever a run crosses a block boundary.
   */
  unitBytes: number;
  /** `unitEnd - unitStart`, including any skipped mirror halves. */
  addressSpan: number;
  /** True when `unitStart` is a multiple of `unitBytes` (expected for real flash geometry). */
  aligned: boolean;
  /** True when the run reaches a span edge, so the true unit may be larger than measured. */
  truncatedBySpan: boolean;
  /**
   * True when the erased run reaches across two blocks' real halves. The physical erase
   * unit is then larger than one block's backed storage.
   */
  spansBlockGap: boolean;
  markerAddress: number;
  resolution: number;
}

/**
 * Pass-2 analysis: locate the contiguous erased run containing the marker.
 *
 * `readings` must cover the whole span at {@link AT_D890_PROBE.SENTINEL_STRIDE}, ascending.
 */
export function analyseAtD890EraseUnit(
  readings: readonly AtD890SentinelReading[],
): AtD890EraseUnitResult {
  if (readings.length === 0) {
    throw new RadioProtocolError('D890 erase probe: no sentinel readings');
  }
  const sorted = [...readings].sort((a, b) => a.address - b.address);
  const marker = AT_D890_PROBE.MARKER_ADDRESS;

  const markerIdx = sorted.findIndex(
    (r) => marker >= r.address && marker < r.address + AT_D890_PROBE.SENTINEL_STRIDE,
  );
  if (markerIdx < 0) {
    throw new RadioProtocolError(
      `D890 erase probe: marker 0x${marker.toString(16)} is outside the sampled span`,
    );
  }
  if (sorted[markerIdx]!.state === 'intact') {
    throw new RadioProtocolError(
      'D890 erase probe: the sentinel cell holding the marker survived — no erase was observed. ' +
        'Confirm the marker write was committed (END sent, radio power-cycled).',
    );
  }

  let lo = markerIdx;
  while (lo > 0 && sorted[lo - 1]!.state === 'erased') lo -= 1;
  let hi = markerIdx;
  while (hi < sorted.length - 1 && sorted[hi + 1]!.state === 'erased') hi += 1;

  const unitStart = sorted[lo]!.address;
  const unitEnd = sorted[hi]!.address + AT_D890_PROBE.SENTINEL_STRIDE;
  const addressSpan = unitEnd - unitStart;
  const erasedCells = hi - lo + 1;
  // Backed bytes only — the grid skips each block's mirrored upper half, so a run crossing
  // a block boundary spans more addresses than it does real storage.
  const unitBytes = erasedCells * AT_D890_PROBE.SENTINEL_STRIDE;

  return {
    unitStart,
    unitEnd,
    unitBytes,
    addressSpan,
    aligned: unitStart % unitBytes === 0,
    truncatedBySpan: lo === 0 || hi === sorted.length - 1,
    spansBlockGap: addressSpan !== unitBytes,
    markerAddress: marker,
    resolution: AT_D890_PROBE.SENTINEL_STRIDE,
  };
}

export interface AtD890ThroughputSample {
  frames: number;
  elapsedMs: number;
}

export interface AtD890ThroughputResult {
  framesPerSecond: number;
  msPerFrame: number;
  /** Payload throughput, i.e. 16 useful bytes per frame. */
  payloadBytesPerSecond: number;
}

/**
 * Convert a timed run of 16-byte frames into throughput, so full erase-unit RMW can be
 * costed from measurement rather than from the nominal baud rate.
 */
export function summariseAtD890Throughput({
  frames,
  elapsedMs,
}: AtD890ThroughputSample): AtD890ThroughputResult {
  if (frames <= 0 || elapsedMs <= 0) {
    return { framesPerSecond: 0, msPerFrame: 0, payloadBytesPerSecond: 0 };
  }
  const framesPerSecond = (frames * 1000) / elapsedMs;
  return {
    framesPerSecond,
    msPerFrame: elapsedMs / frames,
    payloadBytesPerSecond: framesPerSecond * AT_D890_BLOCK_SIZE,
  };
}

/** Estimated wall-clock for a full read+write RMW pass, given a measured frame rate. */
export function estimateAtD890RmwSeconds(
  unitBytes: number,
  touchedUnits: number,
  framesPerSecond: number,
): number {
  if (framesPerSecond <= 0) return Number.POSITIVE_INFINITY;
  const framesPerUnit = unitBytes / AT_D890_BLOCK_SIZE;
  return (framesPerUnit * touchedUnits * 2) / framesPerSecond;
}
