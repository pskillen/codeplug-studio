/**
 * Round-trip tests for AmAir / AmZone codecs using hardware-verified byte patterns.
 */

import { describe, expect, it } from 'vitest';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import {
  decodeAmAirRecord,
  encodeAmAirIntoAtD890Image,
  encodeAmAirRecord,
} from './amAirCodec.ts';
import {
  decodeAmZoneRecord,
  encodeAmZoneRecord,
  encodeAmZonesIntoAtD890Image,
} from './amZoneCodec.ts';
import { listSetBits } from './bitmap.ts';
import { AT_D890_MAP_SIZE, D890_MAP } from './constants.ts';
import { amAirDataAddress, amZoneDataAddress } from './memory.ts';

/** Zone 0 "Glasgow Airband" head — transcribed from hardware dump 2026-07-28. */
const ZONE0_HEAD = Uint8Array.from([
  0x47, 0x00, 0x6c, 0x00, 0x61, 0x00, 0x73, 0x00, 0x67, 0x00, 0x6f, 0x00, 0x77, 0x00, 0x20, 0x00,
  0x41, 0x00, 0x69, 0x00, 0x72, 0x00, 0x62, 0x00, 0x61, 0x00, 0x6e, 0x00, 0x64, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x12, 0x00, 0x10, 0x00, 0x0f, 0x00, 0x11, 0x00, 0x07, 0x00, 0x17, 0x00, 0x16, 0x00,
  0x13, 0x00, 0x15, 0x00, 0x14, 0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
]);

const ZONE0_MEMBERS_1BASED = [19, 17, 16, 18, 8, 24, 23, 20, 22, 21];

const SCAN_HEAD = Uint8Array.from([
  0xff, 0x03, 0x00, 0x00, 0xff, 0x01, 0x00, 0x00, 0x1f, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

const ACHANNEL_POS_012 = Uint8Array.from([
  0x00, 0x00, 0x01, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

describe('amAirCodec', () => {
  it('encodes BCD frequency + wide-char name with zero padding', () => {
    // Hardware sample: 11 90 55 00 → 119.0550 MHz
    const record = encodeAmAirRecord({
      slotIndex: 1,
      wireName: 'Tower',
      rxHz: 119_055_000,
    });
    expect([...record.subarray(0, 4)]).toEqual([0x11, 0x90, 0x55, 0x00]);
    expect(decodeAmAirRecord(record)).toEqual({ rxHz: 119_055_000, wireName: 'Tower' });
    expect(record.subarray(0x24).every((b) => b === 0)).toBe(true);
  });

  it('round-trips through the AmAir bank image', () => {
    const image = createMemoryMap(AT_D890_MAP_SIZE);
    image.fill(0, AT_D890_MAP_SIZE, 0xff);
    encodeAmAirIntoAtD890Image(image, [
      { slotIndex: 1, wireName: 'A', rxHz: 118_000_000 },
      { slotIndex: 3, wireName: 'C', rxHz: 121_500_000 },
    ]);
    const set = image.get(D890_MAP.AmAirSet, D890_MAP.AmAirSetLength);
    expect(listSetBits(set)).toEqual([0, 2]);
    expect(decodeAmAirRecord(image.get(amAirDataAddress(0), D890_MAP.AmAirDataLength)).wireName).toBe(
      'A',
    );
    expect(decodeAmAirRecord(image.get(amAirDataAddress(2), D890_MAP.AmAirDataLength)).rxHz).toBe(
      121_500_000,
    );
  });
});

describe('amZoneCodec', () => {
  it('encodes the hardware-verified Glasgow Airband zone head', () => {
    const record = encodeAmZoneRecord({
      wireName: 'Glasgow Airband',
      channelNumbers: ZONE0_MEMBERS_1BASED,
    });
    expect([...record.subarray(0, ZONE0_HEAD.length)]).toEqual([...ZONE0_HEAD]);
    expect(record.subarray(0x62).every((b) => b === 0)).toBe(true);
    expect(decodeAmZoneRecord(record)).toEqual({
      wireName: 'Glasgow Airband',
      channelIndices0: ZONE0_MEMBERS_1BASED.map((n) => n - 1),
    });
  });

  it('writes A-channel as u16 LE and scan bits by member position', () => {
    const image = createMemoryMap(AT_D890_MAP_SIZE);
    image.fill(0, AT_D890_MAP_SIZE, 0xff);
    encodeAmZonesIntoAtD890Image(image, [
      {
        wireName: 'Z0',
        channelNumbers: Array.from({ length: 10 }, (_, i) => i + 1),
        aChannelMemberIndex: 0,
      },
      {
        wireName: 'Z1',
        channelNumbers: Array.from({ length: 9 }, (_, i) => i + 1),
        aChannelMemberIndex: 1,
      },
      {
        wireName: 'Z2',
        channelNumbers: Array.from({ length: 5 }, (_, i) => i + 1),
        aChannelMemberIndex: 2,
      },
    ]);

    expect([
      ...image.get(D890_MAP.AmZoneAChannel, D890_MAP.AmZoneAChannelLength).subarray(0, 16),
    ]).toEqual([...ACHANNEL_POS_012]);
    expect([...image.get(D890_MAP.AmZoneScan, 16)]).toEqual([...SCAN_HEAD]);

    const set = image.get(D890_MAP.AmZoneSet, D890_MAP.AmZoneSetLength);
    expect(listSetBits(set)).toEqual([0, 1, 2]);
    expect(
      decodeAmZoneRecord(image.get(amZoneDataAddress(0), D890_MAP.AmZoneDataLength)).wireName,
    ).toBe('Z0');
  });
});
