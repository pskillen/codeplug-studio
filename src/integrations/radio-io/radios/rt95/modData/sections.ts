import { crc16CcittFalse } from '../../../kit/checksums.ts';
import { concatBytes, mapGeneration, u16le } from './bytes.ts';
import {
  MMD1_BLOCK_BYTES,
  MMDS_ADDR,
  MMDS_MAGIC,
  MMDO_ADDR,
  MMDO_MAGIC,
  MMDO_DATA_CAPACITY,
  MMD_SECTION_HEADER_BYTES,
  MMD_SECTION_VERSION,
} from './layout.ts';
import type { Rt95ModBlock, Rt95ModZone } from './encode.ts';

/** What a section encoded: its generation, record bytes, per-zone kind bits and the zones that fell back. */
export interface Rt95SectionInfo {
  generation: number;
  /** Record bytes after the section header. */
  length: number;
  /** One entry per zone: 1 = a custom record is written, 0 = the default (ascending, or all channels). */
  kinds: number[];
  /** Zones whose custom order did not fit in MMDO and were written as the default. */
  fallback: number[];
}

export interface Rt95SectionEncoded {
  info: Rt95SectionInfo;
  /** Blocks 1.. ascending, then block 0 (the header block) last. */
  blocks: Rt95ModBlock[];
}

/** Encode one MMD1 section (MMDS or MMDO): header, kind bits and the records of the zones that have one. */
function encodeSection(
  magic: string,
  address: number,
  zoneGeneration: number,
  kinds: number[],
  data: Uint8Array[],
  fallback: number[],
): Rt95SectionEncoded {
  const bits = new Uint8Array(4);
  kinds.forEach((kind, i) => {
    bits[i >> 3]! |= kind << (i & 7);
  });
  const generation = mapGeneration(
    crc16CcittFalse(
      concatBytes([
        Uint8Array.from(u16le(zoneGeneration)),
        bits,
        ...data.flatMap((record, i) => (kinds[i] ? [Uint8Array.of(i), record] : [])),
      ]),
    ),
  );
  const records = concatBytes(
    data.flatMap((record, i) => {
      if (!kinds[i]) return [];
      const crc = crc16CcittFalse(
        concatBytes([record, Uint8Array.of(i), Uint8Array.from(u16le(generation))]),
      );
      return [record, Uint8Array.from(u16le(crc))];
    }),
  );
  const raw = new Uint8Array(
    Math.ceil((MMD_SECTION_HEADER_BYTES + records.length) / MMD1_BLOCK_BYTES) * MMD1_BLOCK_BYTES,
  ).fill(0xff);
  const head = new Uint8Array(14);
  head.set(Array.from(magic, (c) => c.charCodeAt(0)));
  head[4] = MMD_SECTION_VERSION;
  head[5] = kinds.length;
  head.set(u16le(zoneGeneration), 8);
  head.set(u16le(generation), 10);
  head.set(u16le(records.length), 12);
  raw.set(head);
  raw.set(u16le(crc16CcittFalse(concatBytes([head, bits]))), 14);
  raw.set(bits, 16);
  raw.set(records, MMD_SECTION_HEADER_BYTES);
  const blocks: Rt95ModBlock[] = [];
  for (let offset = MMD1_BLOCK_BYTES; offset < raw.length; offset += MMD1_BLOCK_BYTES)
    blocks.push({ address: address + offset, bytes: raw.slice(offset, offset + MMD1_BLOCK_BYTES) });
  blocks.push({ address, bytes: raw.slice(0, MMD1_BLOCK_BYTES) });
  return { info: { generation, length: records.length, kinds, fallback }, blocks };
}

/**
 * Encode the zone scan-set (MMDS) and member-order (MMDO) sections for the zones as they will be written.
 * `channelIndexes` is the zone order; a scan set is custom when it omits a member; an order is custom when it
 * is not ascending. Orders are admitted in zone order until MMDO's data capacity is full, then fall back.
 */
export function encodeRt95Sections(
  zones: readonly Rt95ModZone[],
  zoneGeneration: number,
): { MMDS: Rt95SectionEncoded; MMDO: Rt95SectionEncoded } {
  const scanKinds: number[] = [];
  const scanData: Uint8Array[] = [];
  const orderKinds: number[] = [];
  const orderData: Uint8Array[] = [];
  const fallback: number[] = [];
  let used = 0;
  zones.forEach((zone, i) => {
    const sorted = [...zone.channelIndexes].sort((a, b) => a - b);
    const scan = new Set(zone.scanIndexes ?? sorted);
    const customScan = sorted.some((member) => !scan.has(member));
    scanKinds.push(Number(customScan));
    const bits = new Uint8Array(customScan ? Math.ceil(sorted.length / 8) : 0);
    if (customScan)
      sorted.forEach((member, j) => {
        if (scan.has(member)) bits[j >> 3]! |= 1 << (j & 7);
      });
    scanData.push(bits);
    let customOrder = zone.channelIndexes.some((member, j) => member !== sorted[j]);
    if (customOrder && used + sorted.length + 2 > MMDO_DATA_CAPACITY) {
      fallback.push(i);
      customOrder = false;
    }
    if (customOrder) used += sorted.length + 2;
    orderKinds.push(Number(customOrder));
    orderData.push(customOrder ? Uint8Array.from(zone.channelIndexes) : new Uint8Array());
  });
  return {
    MMDS: encodeSection(MMDS_MAGIC, MMDS_ADDR, zoneGeneration, scanKinds, scanData, []),
    MMDO: encodeSection(MMDO_MAGIC, MMDO_ADDR, zoneGeneration, orderKinds, orderData, fallback),
  };
}
