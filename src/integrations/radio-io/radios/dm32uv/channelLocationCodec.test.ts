import { describe, expect, it } from 'vitest';
import { compassOctant, haversineDistanceM, initialBearingDeg } from '@core/domain/geoDistance.ts';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import type { RadioWriteOrganisation } from '../../radioWriteProjection.ts';
import {
  DM32_BLOCK_SIZE,
  DM32_CHANNEL_LOCATION,
  DM32_METADATA,
  DM32_METADATA_OFFSET,
} from './constants.ts';
import { encodeDm32uvWriteImageFromDownloadCache } from './hydration.ts';
import type { Dm32DownloadCache } from './protocol.ts';
import {
  assertDm32ChannelLocationPagesWritable,
  decodeDm32ChannelLocationPage,
  dm32ChannelFingerprint,
  DM32_CHANNEL_LOCATION_CAPACITY,
  encodeDm32ChannelLocationEntry,
} from './channelLocationCodec.ts';
import { encodeDm32ChannelRecord } from './channelCodec.ts';

const toHex = (b: Uint8Array) => Buffer.from(b).toString('hex');
const BASE = 0x1000;
const GLASGOW = { lat: 55.852056, lon: -4.259463 };

function block(metadata: number, mutate?: (b: Uint8Array) => void): Uint8Array {
  const b = new Uint8Array(DM32_BLOCK_SIZE).fill(0xff);
  b[DM32_METADATA_OFFSET] = metadata;
  mutate?.(b);
  return b;
}

function channel(slotIndex: number, over: Partial<RadioChannelDto> = {}): RadioChannelDto {
  return {
    slotIndex,
    empty: false,
    wireName: `CH${slotIndex}`,
    rxHz: 145_725_000,
    txHz: 145_125_000,
    rxTone: { kind: 'none' },
    txTone: { kind: 'none' },
    powerPercent: null,
    bandwidth: 'NFM',
    ...over,
  };
}

/**
 * Pages, in address order from {@link BASE}: `metadata[i]` sits at `BASE + i * 4 KiB`.
 * Channel bank pages (`0x12`, `0x13`, …) are included so channels can be encoded.
 */
function cacheWith(
  metadata: readonly number[],
  extra?: Map<number, Uint8Array>,
): Dm32DownloadCache {
  const discovered = metadata.map((m, i) => ({
    address: BASE + i * DM32_BLOCK_SIZE,
    metadata: m,
    type: 'unknown' as const,
  }));
  const blocks = new Map<number, Uint8Array>();
  metadata.forEach((m, i) => {
    if (m >= DM32_METADATA.CHANNEL_FIRST && m <= DM32_METADATA.CHANNEL_LAST) {
      blocks.set(
        BASE + i * DM32_BLOCK_SIZE,
        block(m, (b) => b.fill(0, 0, 2)),
      );
    }
  });
  for (const [addr, data] of extra ?? []) blocks.set(addr, data);
  return {
    addressBase: BASE,
    mapSize: metadata.length * DM32_BLOCK_SIZE,
    discovered,
    blocks,
  };
}

const MM9PDY: RadioWriteOrganisation = { writeChannelLocationTable: true };
const pageAt = (image: { get(o: number, l: number): Uint8Array }, addr: number) =>
  image.get(addr - BASE, DM32_BLOCK_SIZE);

describe('DM-32UV channel location entry', () => {
  it('encodes the golden entry (flags, FF, fingerprint, lat, lon)', () => {
    const record = encodeDm32ChannelRecord(channel(1, { wireName: 'GB3GL' }));
    expect(toHex(record.subarray(0x10, 0x14))).toBe('00255714');
    expect(toHex(encodeDm32ChannelLocationEntry(record, GLASGOW))).toBe('01ff0fe5183c54037901bfff');
    expect(dm32ChannelFingerprint(record)).toBe(0xe50f);
  });
});

describe('encodeDm32ChannelLocationPagesIntoImage (via the MM9PDY Write encode)', () => {
  it('claims the lowest free page for page 0 and writes header, entry and tag', () => {
    const cache = cacheWith([DM32_METADATA.CHANNEL_FIRST, DM32_METADATA.VFO_SETTINGS, 0xff, 0x00]);
    const ch = channel(1, { wireName: 'GB3GL', useLocation: true, location: GLASGOW });
    const image = encodeDm32uvWriteImageFromDownloadCache(cache, [ch], MM9PDY);
    expect(cache.locationWritePages).toEqual([
      { address: BASE + 0x2000, tag: 0x70, pageIndex: 0, mode: 'claim' },
    ]);
    const page = pageAt(image, BASE + 0x2000);
    expect(toHex(page.subarray(0, 16))).toBe('4d4c4f4301000c000100ffffffffffff');
    expect(toHex(page.subarray(16, 28))).toBe('01ff0fe5183c54037901bfff');
    expect(page.subarray(28, DM32_METADATA_OFFSET).every((b) => b === 0xff)).toBe(true);
    expect(page[DM32_METADATA_OFFSET]).toBe(0x70);
  });

  it('writes the miles unit and the first channel of later pages', () => {
    const cache = cacheWith([DM32_METADATA.CHANNEL_FIRST, 0x13, 0x14, 0x15, 0x16, 0xff]);
    const ch = channel(340, { useLocation: true, location: GLASGOW });
    const image = encodeDm32uvWriteImageFromDownloadCache(cache, [ch], {
      ...MM9PDY,
      channelDistanceUnit: 'mi',
    });
    expect(cache.locationWritePages).toEqual([
      { address: BASE + 0x5000, tag: 0x71, pageIndex: 1, mode: 'claim' },
    ]);
    const page = pageAt(image, BASE + 0x5000);
    expect(toHex(page.subarray(0, 16))).toBe('4d4c4f4301010c015401ffffffffffff');
    expect(page[16]).toBe(0x01);
  });

  it('overwrites a live page in place and never creates a duplicate tag', () => {
    // Two live 0x70 pages (radio leftovers) and a free page: reuse the lower 0x70 only.
    const cache = cacheWith([DM32_METADATA.CHANNEL_FIRST, 0xff, 0x70, 0x70]);
    const ch = channel(1, { useLocation: true, location: GLASGOW });
    encodeDm32uvWriteImageFromDownloadCache(cache, [ch], MM9PDY);
    expect(cache.locationWritePages).toEqual([
      { address: BASE + 0x2000, tag: 0x70, pageIndex: 0, mode: 'reuse' },
    ]);
  });

  it('creates no page without a position, but rewrites a live page to clear it', () => {
    const stale = block(0x71, (b) => {
      b.set(new TextEncoder().encode('MLOC'), 0);
      b[16] = 0x01;
    });
    const cache = cacheWith(
      [DM32_METADATA.CHANNEL_FIRST, 0xff, 0x71],
      new Map([[BASE + 0x2000, stale]]),
    );
    const image = encodeDm32uvWriteImageFromDownloadCache(
      cache,
      [channel(1), channel(2, { useLocation: false, location: GLASGOW })],
      MM9PDY,
    );
    expect(cache.locationWritePages).toEqual([
      { address: BASE + 0x2000, tag: 0x71, pageIndex: 1, mode: 'reuse' },
    ]);
    const page = decodeDm32ChannelLocationPage(pageAt(image, BASE + 0x2000), 1)!;
    expect(page.entries.every((e) => e === null)).toBe(true);
    expect(pageAt(image, BASE + 0x1000).every((b) => b === 0xff)).toBe(true);
  });

  it('never reuses a page the zone encode claimed', () => {
    const cache = cacheWith([DM32_METADATA.CHANNEL_FIRST, DM32_METADATA.ZONE, 0xff, 0xff]);
    const many = Array.from({ length: 40 }, (_, i) => ({
      wireName: `Z${i}`,
      channelNumbers: [1],
    }));
    const ch = channel(1, { useLocation: true, location: GLASGOW });
    encodeDm32uvWriteImageFromDownloadCache(cache, [ch], { ...MM9PDY, zones: many });
    expect(cache.zoneWriteAddresses).toEqual([BASE + 0x2000]);
    expect(cache.locationWritePages?.[0]?.address).toBe(BASE + 0x3000);
  });

  it('leaves the location tags alone on a stock encode', () => {
    const live = block(0x70, (b) => b.fill(0x42, 0, 16));
    const cache = cacheWith(
      [DM32_METADATA.CHANNEL_FIRST, 0x70, 0xff],
      new Map([[BASE + 0x1000, live]]),
    );
    const ch = channel(1, { useLocation: true, location: GLASGOW });
    const image = encodeDm32uvWriteImageFromDownloadCache(cache, [ch], {});
    expect(cache.locationWritePages).toBeUndefined();
    expect(pageAt(image, BASE + 0x1000)).toEqual(live);
    expect(pageAt(image, BASE + 0x2000).every((b) => b === 0xff)).toBe(true);
  });

  it('bounds the table to 12 pages of 339 entries', () => {
    expect(DM32_CHANNEL_LOCATION_CAPACITY).toBe(4068);
    expect(DM32_CHANNEL_LOCATION.TAGS).toHaveLength(12);
    expect(DM32_CHANNEL_LOCATION.HEADER_BYTES + 339 * 12).toBeLessThan(DM32_METADATA_OFFSET);
  });
});

describe('decodeDm32ChannelLocationPage', () => {
  it('round-trips positions, signs and fingerprints', () => {
    const cache = cacheWith([DM32_METADATA.CHANNEL_FIRST, 0xff]);
    const south = { lat: -33.856784, lon: 151.215297 };
    const chs = [
      channel(1, { wireName: 'GB3GL', useLocation: true, location: GLASGOW }),
      channel(2),
      channel(3, { useLocation: true, location: south }),
    ];
    const image = encodeDm32uvWriteImageFromDownloadCache(cache, chs, MM9PDY);
    const page = decodeDm32ChannelLocationPage(pageAt(image, BASE + 0x1000), 0)!;
    expect(page).toMatchObject({ pageIndex: 0, unit: 'km', firstChannel: 1 });
    expect(page.entries[0]).toEqual({
      fingerprint: 0xe50f,
      latMicro: 55_852_056,
      lonMicro: -4_259_463,
    });
    expect(page.entries[1]).toBeNull();
    expect(page.entries[2]).toMatchObject({ latMicro: -33_856_784, lonMicro: 151_215_297 });
  });

  it('rejects a bad magic, version or page index', () => {
    const cache = cacheWith([DM32_METADATA.CHANNEL_FIRST, 0xff]);
    const ch = channel(1, { useLocation: true, location: GLASGOW });
    const page = pageAt(
      encodeDm32uvWriteImageFromDownloadCache(cache, [ch], MM9PDY),
      BASE + 0x1000,
    );
    const bad = page.slice();
    bad[0] = 0x00;
    expect(decodeDm32ChannelLocationPage(bad)).toBeNull();
    const badVersion = page.slice();
    badVersion[4] = 2;
    expect(decodeDm32ChannelLocationPage(badVersion)).toBeNull();
    expect(decodeDm32ChannelLocationPage(page, 3)).toBeNull();
  });
});

describe('assertDm32ChannelLocationPagesWritable', () => {
  const live = (pairs: [number, number][]) =>
    pairs.map(([address, metadata]) => ({ address, metadata }));

  it('accepts unchanged reuse and still-free claims', () => {
    expect(() =>
      assertDm32ChannelLocationPagesWritable(
        [
          { address: 0x2000, tag: 0x70, pageIndex: 0, mode: 'reuse' },
          { address: 0x3000, tag: 0x71, pageIndex: 1, mode: 'claim' },
        ],
        live([
          [0x2000, 0x70],
          [0x3000, 0xff],
        ]),
      ),
    ).not.toThrow();
  });

  it('refuses a claim that is no longer free or whose tag appeared elsewhere', () => {
    const claim = [{ address: 0x3000, tag: 0x71, pageIndex: 1, mode: 'claim' as const }];
    expect(() => assertDm32ChannelLocationPagesWritable(claim, live([[0x3000, 0x02]]))).toThrow(
      /Read the radio again/,
    );
    expect(() =>
      assertDm32ChannelLocationPagesWritable(
        claim,
        live([
          [0x3000, 0xff],
          [0x4000, 0x71],
        ]),
      ),
    ).toThrow(/Read the radio again/);
  });

  it('refuses a reuse when a lower page now holds the tag', () => {
    expect(() =>
      assertDm32ChannelLocationPagesWritable(
        [{ address: 0x3000, tag: 0x70, pageIndex: 0, mode: 'reuse' }],
        live([
          [0x2000, 0x70],
          [0x3000, 0x70],
        ]),
      ),
    ).toThrow(/Read the radio again/);
  });
});

describe('stored coordinates against core/domain/geoDistance.ts', () => {
  it('give distance within 1% and the same compass point', () => {
    const user = { lat: 55.9533, lon: -3.1883 };
    const sites = [GLASGOW, { lat: 56.4907, lon: -4.2026 }, { lat: 54.6, lon: -5.93 }];
    const cache = cacheWith([DM32_METADATA.CHANNEL_FIRST, 0xff]);
    const chs = sites.map((loc, i) => channel(i + 1, { useLocation: true, location: loc }));
    const image = encodeDm32uvWriteImageFromDownloadCache(cache, chs, MM9PDY);
    const page = decodeDm32ChannelLocationPage(pageAt(image, BASE + 0x1000), 0)!;
    sites.forEach((site, i) => {
      const e = page.entries[i]!;
      const meanLat = ((user.lat + e.latMicro / 1e6) / 2) * (Math.PI / 180);
      const dLat = e.latMicro / 1e6 - user.lat;
      const dLon = (e.lonMicro / 1e6 - user.lon) * Math.cos(meanLat);
      const metres = Math.sqrt(dLat * dLat + dLon * dLon) * 111_195;
      const exact = haversineDistanceM(user.lat, user.lon, site.lat, site.lon);
      expect(Math.abs(metres - exact) / exact).toBeLessThan(0.01);
      const bearing = ((Math.atan2(dLon, dLat) * 180) / Math.PI + 360) % 360;
      expect(compassOctant(bearing)).toBe(
        compassOctant(initialBearingDeg(user.lat, user.lon, site.lat, site.lon)),
      );
    });
  });
});
