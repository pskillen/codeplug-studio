import { describe, expect, it } from 'vitest';
import { compassOctant, haversineDistanceM, initialBearingDeg } from '@core/domain/geoDistance.ts';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import { crc16CcittFalse, crc32Ieee } from '../../kit/checksums.ts';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import type { MemoryMap } from '../../types.ts';
import {
  AT_D890_CHANNEL_LOCATION,
  AT_D890_CHANNEL_LOCATION_TABLE_MAX_BYTES,
  AT_D890_LIMITS,
  AT_D890_MAP_SIZE,
  D890_MAP,
} from './constants.ts';
import { encodeChannelsIntoAtD890Image, readCombinedChannelRecord } from './channelCodec.ts';
import {
  atD890ChannelNameCrc,
  decodeAtD890ChannelLocationTable,
  encodeAtD890ChannelLocationEntry,
  encodeAtD890ChannelLocationTable,
} from './channelLocationCodec.ts';
import { channelPrimaryAddress, channelSecondaryAddress } from './memory.ts';

const toHex = (b: Uint8Array) => Buffer.from(b).toString('hex');

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
    mode: 'analog',
    ...over,
  };
}

function imageWith(channels: readonly RadioChannelDto[]): MemoryMap {
  const image = createMemoryMap(AT_D890_MAP_SIZE);
  image.fill(D890_MAP.ChannelSet, AT_D890_LIMITS.CHANNEL_SET_BYTES, 0);
  return encodeChannelsIntoAtD890Image(image, channels);
}

/** Hand-built `0x80` record: RX 145.725 MHz, name `GB3GL`. */
function goldenRecord(): Uint8Array {
  const record = new Uint8Array(0x80);
  record.set([0x14, 0x57, 0x25, 0x00], 0);
  record.set([0x47, 0x00, 0x42, 0x00, 0x33, 0x00, 0x47, 0x00, 0x4c, 0x00], 0x44);
  return record;
}

const GLASGOW = { lat: 55.852056, lon: -4.259463 };

describe('checksums', () => {
  it('match the catalogue check values', () => {
    const check = new TextEncoder().encode('123456789');
    expect(crc16CcittFalse(check)).toBe(0x29b1);
    expect(crc32Ieee(check)).toBe(0xcbf43926);
  });
});

describe('AT-D890UV channel location entry', () => {
  it('encodes the golden entry (lat, lon, RX bytes, name CRC, flags, check)', () => {
    const entry = encodeAtD890ChannelLocationEntry(goldenRecord(), GLASGOW);
    expect(toHex(entry)).toBe('183c54037901bfff14572500d3600102');
  });

  it('stops the name CRC at 0000 or FFFF and at 16 units', () => {
    const record = goldenRecord();
    const viaZero = atD890ChannelNameCrc(record);
    record.set([0xff, 0xff, 0x41, 0x00], 0x4e);
    expect(atD890ChannelNameCrc(record)).toBe(viaZero);

    const full = new Uint8Array(0x80);
    const name = new TextEncoder().encode('ABCDEFGHIJKLMNOPQ');
    name.forEach((ch, i) => (full[0x44 + i * 2] = ch));
    expect(atD890ChannelNameCrc(full)).toBe(0xfcd0);
  });
});

describe('encodeAtD890ChannelLocationTable', () => {
  it('writes the header with magic, version, entry size, count, unit and CRC-32', () => {
    const image = imageWith([channel(1, { useLocation: true, location: GLASGOW })]);
    const { bytes, count } = encodeAtD890ChannelLocationTable(image, [], 'km');
    expect(count).toBe(1);
    expect(toHex(bytes.subarray(0, 32))).toBe(
      '4c4f4331011001000000000000000000000000000000000000000000e0e3c3b8',
    );
    const three = imageWith([channel(3)]);
    expect(toHex(encodeAtD890ChannelLocationTable(three, [], 'mi').bytes.subarray(0, 32))).toBe(
      '4c4f43310110030001000000000000000000000000000000000000002611f4f3',
    );
  });

  it('computes the fingerprint from the encoded channel record', () => {
    const ch = channel(2, { wireName: 'GB3GL', useLocation: true, location: GLASGOW });
    const image = imageWith([channel(1), ch]);
    const { bytes, positions } = encodeAtD890ChannelLocationTable(image, [ch]);
    expect(positions).toBe(1);
    const record = readCombinedChannelRecord(image, 1);
    const entry = bytes.subarray(0x30, 0x40);
    expect(entry.subarray(8, 12)).toEqual(record.subarray(0, 4));
    expect(toHex(entry)).toBe('183c54037901bfff14572500d3600102');
  });

  it('writes every slot up to the highest channel and leaves empty slots all 00', () => {
    const located = channel(5, { useLocation: true, location: GLASGOW });
    const image = imageWith([channel(1), channel(3), located]);
    const { bytes, count } = encodeAtD890ChannelLocationTable(image, [
      channel(1),
      channel(3, { useLocation: false, location: GLASGOW }),
      located,
    ]);
    expect(count).toBe(5);
    expect(bytes.length).toBe(0x20 + 5 * 16);
    for (const slot of [0, 1, 2, 3]) {
      expect(bytes.subarray(0x20 + slot * 16, 0x30 + slot * 16).every((b) => b === 0)).toBe(true);
    }
    expect(bytes[0x20 + 4 * 16 + 14]).toBe(1);
  });

  it('bounds the table to the 4000-entry capacity', () => {
    expect(AT_D890_CHANNEL_LOCATION_TABLE_MAX_BYTES).toBe(0xfa20);
    const last = channel(4000, { useLocation: true, location: GLASGOW });
    const image = imageWith([last]);
    const { bytes, count } = encodeAtD890ChannelLocationTable(image, [
      last,
      channel(4001, { useLocation: true, location: GLASGOW }),
    ]);
    expect(count).toBe(AT_D890_CHANNEL_LOCATION.MAX_ENTRIES);
    expect(bytes.length).toBe(AT_D890_CHANNEL_LOCATION_TABLE_MAX_BYTES);
  });

  it('skips a position for a slot the image does not hold', () => {
    const image = imageWith([channel(1)]);
    const ghost = channel(1, { useLocation: true, location: GLASGOW });
    image.fill(channelPrimaryAddress(0), 0x40, 0);
    image.fill(channelSecondaryAddress(0), 0x40, 0);
    image.fill(D890_MAP.ChannelSet, AT_D890_LIMITS.CHANNEL_SET_BYTES, 0);
    expect(encodeAtD890ChannelLocationTable(image, [ghost]).positions).toBe(0);
  });
});

describe('decodeAtD890ChannelLocationTable', () => {
  it('round-trips a table', () => {
    const south = { lat: -33.856784, lon: 151.215297 };
    const chs = [
      channel(1, { useLocation: true, location: GLASGOW }),
      channel(2),
      channel(3, { useLocation: true, location: south }),
    ];
    const { bytes } = encodeAtD890ChannelLocationTable(imageWith(chs), chs, 'mi');
    const table = decodeAtD890ChannelLocationTable(bytes)!;
    expect(table.unit).toBe('mi');
    expect(table.count).toBe(3);
    expect(table.entries[0]).toMatchObject({ latMicro: 55_852_056, lonMicro: -4_259_463 });
    expect(table.entries[1]).toBeNull();
    expect(table.entries[2]).toMatchObject({ latMicro: -33_856_784, lonMicro: 151_215_297 });
  });

  it('decodes a bad magic, header CRC or entry check as empty', () => {
    const chs = [channel(1, { useLocation: true, location: GLASGOW })];
    const { bytes } = encodeAtD890ChannelLocationTable(imageWith(chs), chs);

    const badMagic = bytes.slice();
    badMagic[0] = 0x58;
    expect(decodeAtD890ChannelLocationTable(badMagic)).toBeNull();

    const badCrc = bytes.slice();
    badCrc[8] = 1;
    expect(decodeAtD890ChannelLocationTable(badCrc)).toBeNull();

    const badCheck = bytes.slice();
    badCheck[0x20] ^= 0x01;
    expect(decodeAtD890ChannelLocationTable(badCheck)!.entries[0]).toBeNull();

    const factory = new Uint8Array(0x40).fill(0x55);
    expect(decodeAtD890ChannelLocationTable(factory)).toBeNull();
  });
});

/**
 * Reference for the firmware's integer maths: equirectangular in micro-degrees, compass
 * from the same deltas. Studio does not show distances; this checks that the stored
 * coordinates (scale, signs, axis order) give the distance and octant the spec expects.
 */
function firmwareStyleDistance(
  from: { latMicro: number; lonMicro: number },
  to: { latMicro: number; lonMicro: number },
): { metres: number; octant: string } {
  const meanLat = ((from.latMicro + to.latMicro) / 2 / 1e6) * (Math.PI / 180);
  const dLat = (to.latMicro - from.latMicro) / 1e6;
  const dLon = ((to.lonMicro - from.lonMicro) / 1e6) * Math.cos(meanLat);
  const metres = Math.sqrt(dLat * dLat + dLon * dLon) * 111_195;
  const bearing = ((Math.atan2(dLon, dLat) * 180) / Math.PI + 360) % 360;
  return { metres, octant: compassOctant(bearing) };
}

describe('stored coordinates against core/domain/geoDistance.ts', () => {
  it('give distance within 1% and the same compass point', () => {
    const user = { lat: 55.9533, lon: -3.1883 };
    const sites = [
      GLASGOW,
      { lat: 56.4907, lon: -4.2026 },
      { lat: 55.0, lon: -1.6 },
      { lat: 54.6, lon: -5.93 },
    ];
    const chs = sites.map((loc, i) => channel(i + 1, { useLocation: true, location: loc }));
    const table = decodeAtD890ChannelLocationTable(
      encodeAtD890ChannelLocationTable(imageWith(chs), chs).bytes,
    )!;
    const userMicro = {
      latMicro: Math.round(user.lat * 1e6),
      lonMicro: Math.round(user.lon * 1e6),
    };
    sites.forEach((site, i) => {
      const entry = table.entries[i]!;
      const fw = firmwareStyleDistance(userMicro, entry);
      const exact = haversineDistanceM(user.lat, user.lon, site.lat, site.lon);
      expect(Math.abs(fw.metres - exact) / exact).toBeLessThan(0.01);
      expect(fw.octant).toBe(
        compassOctant(initialBearingDeg(user.lat, user.lon, site.lat, site.lon)),
      );
    });
  });
});
