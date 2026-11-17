import { crc16CcittFalse } from '../../../kit/checksums.ts';
import { concatBytes, mapGeneration, u16le } from './encode.ts';
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

export interface Rt95SectionInfo {
  generation: number;
  length: number;
  kinds: number[];
  fallback: number[];
}

function encodeSection(
  magic: string,
  address: number,
  zoneGeneration: number,
  kinds: number[],
  data: Uint8Array[],
  fallback: number[],
): { info: Rt95SectionInfo; blocks: Rt95ModBlock[] } {
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

export function encodeRt95Sections(zones: readonly Rt95ModZone[], zoneGeneration: number) {
  const scanKinds: number[] = [],
    scanData: Uint8Array[] = [],
    orderKinds: number[] = [],
    orderData: Uint8Array[] = [],
    fallback: number[] = [];
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
