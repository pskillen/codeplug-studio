/**
 * Golden vectors from the firmware repo (pskillen/baofeng-dm32-firmware, channel distance
 * #71: `docs/features/channel-distance/mloc-v1-vectors.json`, storage contract v1). The
 * firmware's own decoder accepts every page here; copied so Studio's writer is held to the
 * same bytes. Synthetic records only.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import { DM32_BLOCK_SIZE, DM32_METADATA, DM32_METADATA_OFFSET } from './constants.ts';
import { dm32ChannelRecordImageOffset } from './channelCodec.ts';
import {
  decodeDm32ChannelLocationPage,
  dm32ChannelFingerprint,
  encodeDm32ChannelLocationPagesIntoImage,
} from './channelLocationCodec.ts';

const hex = (s: string) => Uint8Array.from(Buffer.from(s, 'hex'));
const toHex = (b: Uint8Array) => Buffer.from(b).toString('hex');
const sha256 = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

const RECORDS: Record<number, { record: string; fingerprint: number; lat: number; lon: number }> = {
  1: {
    record: '4742334142204578616d706c6500ffff50129443',
    fingerprint: 0x8fc3,
    lat: 54_620_000,
    lon: -5_880_000,
  },
  339: {
    record: '474237585900ffffffffffffffffffff50870943',
    fingerprint: 0x548e,
    lat: -33_868_800,
    lon: 151_209_300,
  },
  340: {
    record: '4c6f63616c20326d00ffffffffffffff00005514',
    fingerprint: 0xe2d3,
    lat: 55_864_200,
    lon: -4_251_800,
  },
  4000: {
    record: '53495445203430303000ffffffffffff00503443',
    fingerprint: 0x25ac,
    lat: -12_500_000,
    lon: -77_000_000,
  },
};

const PAGES = [
  {
    k: 0,
    unit: 'km' as const,
    channels: [1, 339],
    header: '4d4c4f4301000c000100ffffffffffff',
    sha: 'eacfbe8900b7ec4645580346f7b9b50fec92b5a33d2d71f382b33498567c2bba',
  },
  {
    k: 1,
    unit: 'mi' as const,
    channels: [340],
    header: '4d4c4f4301010c015401ffffffffffff',
    sha: '74c9c993e8bba8c83280ecf24dbe1b3ec472474619a13921259a7d27e17d46d1',
  },
  {
    k: 11,
    unit: 'km' as const,
    channels: [4000],
    header: '4d4c4f43010b0c00920effffffffffff',
    sha: '2896a3659c0893953652e616aa425737f530a284c0734bfaf9a6e353f832549c',
  },
];

const BASE = 0x1000;
const CHANNEL_PAGES = 48;
const FREE_PAGES = 12;

function encodePages(unit: 'km' | 'mi') {
  const discovered = [
    ...Array.from({ length: CHANNEL_PAGES }, (_, i) => ({
      address: BASE + i * DM32_BLOCK_SIZE,
      metadata: DM32_METADATA.CHANNEL_FIRST + i,
    })),
    ...Array.from({ length: FREE_PAGES }, (_, i) => ({
      address: BASE + (CHANNEL_PAGES + i) * DM32_BLOCK_SIZE,
      metadata: 0xff,
    })),
  ];
  const ctx = { addressBase: BASE, discovered };
  const image = createMemoryMap((CHANNEL_PAGES + FREE_PAGES) * DM32_BLOCK_SIZE);
  image.fill(0, image.size, 0xff);
  const channels: RadioChannelDto[] = [];
  for (const [slot, v] of Object.entries(RECORDS)) {
    const slotIndex = Number(slot);
    image.set(dm32ChannelRecordImageOffset(ctx, slotIndex)!, hex(v.record));
    channels.push({
      slotIndex,
      empty: false,
      wireName: '',
      rxHz: 1,
      txHz: 1,
      rxTone: { kind: 'none' },
      txTone: { kind: 'none' },
      powerPercent: null,
      bandwidth: 'NFM',
      useLocation: true,
      location: { lat: v.lat / 1e6, lon: v.lon / 1e6 },
    });
  }
  const result = encodeDm32ChannelLocationPagesIntoImage(image, ctx, channels, unit);
  return { image, result };
}

describe('DM-32UV channel location v1 firmware vectors', () => {
  it('computes every fingerprint', () => {
    expect(dm32ChannelFingerprint(new TextEncoder().encode('123456789'))).toBe(0x29b1);
    for (const v of Object.values(RECORDS)) {
      expect(dm32ChannelFingerprint(hex(v.record))).toBe(v.fingerprint);
    }
  });

  it.each(PAGES)('page $k matches the firmware page byte for byte', (vector) => {
    const { image, result } = encodePages(vector.unit);
    const page = result.pages.find((p) => p.pageIndex === vector.k)!;
    const bytes = image.get(page.address - BASE, DM32_BLOCK_SIZE);
    expect(toHex(bytes.subarray(0, 16))).toBe(vector.header);
    expect(bytes[DM32_METADATA_OFFSET]).toBe(page.tag);
    expect(sha256(bytes)).toBe(vector.sha);
    const decoded = decodeDm32ChannelLocationPage(bytes, vector.k)!;
    expect(decoded.entries.filter(Boolean)).toHaveLength(vector.channels.length);
  });

  it('rejects the bad headers', () => {
    for (const header of [
      '4d4c4f5801000c000100ffffffffffff',
      '4d4c4f4302000c000100ffffffffffff',
      '4d4c4f4301010c005401ffffffffffff',
      '4d4c4f43010010000100ffffffffffff',
      '4d4c4f4301000c020100ffffffffffff',
      '4d4c4f4301000c000200ffffffffffff',
    ]) {
      const page = new Uint8Array(DM32_BLOCK_SIZE).fill(0xff);
      page.set(hex(header), 0);
      page[DM32_METADATA_OFFSET] = 0x70;
      expect(decodeDm32ChannelLocationPage(page, 0)).toBeNull();
    }
  });

  it('reads flags 00 and an empty FF entry as no position', () => {
    const { image, result } = encodePages('km');
    const page = image.get(result.pages[0]!.address - BASE, DM32_BLOCK_SIZE).slice();
    page.set(hex('00ffc38f0100000001000000'), 16);
    page.set(hex('ffffffffffffffffffffffff'), 16 + 12 * 338);
    const decoded = decodeDm32ChannelLocationPage(page, 0)!;
    expect(decoded.entries[0]).toBeNull();
    expect(decoded.entries[338]).toBeNull();
  });
});
