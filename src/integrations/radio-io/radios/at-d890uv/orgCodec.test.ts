import { describe, expect, it } from 'vitest';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import { D890_MAP } from './constants.ts';
import { encodeZonesIntoAtD890Image } from './zoneCodec.ts';
import { encodeTalkgroupsIntoAtD890Image } from './talkGroupCodec.ts';
import { listSetBits } from './bitmap.ts';
import { listZoneMemberIndicesFromCache } from './zoneCodec.ts';
import { mergeChannelsIntoAtD890uvHydration } from './hydration.ts';
import { createRadioCloneHydrationBagFromBlocks } from '@core/models/radioCloneHydration.ts';
import { AT_D890UV_MODEL_ID } from './hydration.ts';
import type { RadioChannelDto } from '../../radioChannelDto.ts';

function readU16Le(buf: Uint8Array, offset: number): number {
  return buf[offset]! | (buf[offset + 1]! << 8);
}

function writeU16Le(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >>> 8) & 0xff;
}

describe('zoneCodec', () => {
  it('encodes zone membership as 0-based channel indices', () => {
    const image = createMemoryMap(0x500_0000);
    image.fill(0, 0x500_0000, 0xff);
    encodeZonesIntoAtD890Image(image, [{ wireName: 'Z1', channelNumbers: [1, 2] }]);
    const members = image.get(D890_MAP.ZoneChannels, 0x200);
    expect(members[0]).toBe(0);
    expect(members[1]).toBe(0);
    expect(members[2]).toBe(1);
    expect(members[3]).toBe(0);
    expect(members[4]).toBe(0xff);
  });

  it('writes zone-local A/B indices (not global channel numbers)', () => {
    const image = createMemoryMap(0x500_0000);
    image.fill(0, 0x500_0000, 0xff);
    encodeZonesIntoAtD890Image(image, [{ wireName: 'Two', channelNumbers: [10, 20] }]);
    const zoneA = image.get(D890_MAP.ZoneAChannel, 0x200);
    const zoneB = image.get(D890_MAP.ZoneBChannel, 0x200);
    expect(readU16Le(zoneA, 0)).toBe(0);
    expect(readU16Le(zoneB, 0)).toBe(1);
  });

  it('writes A=0 B=0 when zone has one member', () => {
    const image = createMemoryMap(0x500_0000);
    image.fill(0, 0x500_0000, 0xff);
    encodeZonesIntoAtD890Image(image, [{ wireName: 'One', channelNumbers: [5] }]);
    const zoneA = image.get(D890_MAP.ZoneAChannel, 0x200);
    const zoneB = image.get(D890_MAP.ZoneBChannel, 0x200);
    expect(readU16Le(zoneA, 0)).toBe(0);
    expect(readU16Le(zoneB, 0)).toBe(0);
  });

  it('zeros zone A/B table entries at indices 250–255', () => {
    const image = createMemoryMap(0x500_0000);
    image.fill(0, 0x500_0000, 0xff);
    const zoneA = image.get(D890_MAP.ZoneAChannel, D890_MAP.ZoneTableBytes).slice();
    const zoneB = image.get(D890_MAP.ZoneBChannel, D890_MAP.ZoneTableBytes).slice();
    for (let i = 250; i < 256; i++) {
      writeU16Le(zoneA, i * 2, 0xffff);
      writeU16Le(zoneB, i * 2, 0xffff);
    }
    image.set(D890_MAP.ZoneAChannel, zoneA);
    image.set(D890_MAP.ZoneBChannel, zoneB);

    encodeZonesIntoAtD890Image(image, [{ wireName: 'Z1', channelNumbers: [1] }]);

    const outA = image.get(D890_MAP.ZoneAChannel, D890_MAP.ZoneTableBytes);
    const outB = image.get(D890_MAP.ZoneBChannel, D890_MAP.ZoneTableBytes);
    for (let i = 250; i < 256; i++) {
      expect(readU16Le(outA, i * 2)).toBe(0);
      expect(readU16Le(outB, i * 2)).toBe(0);
    }
  });
});

describe('talkGroupCodec', () => {
  it('uses inverted TalkgroupSet bitmap', () => {
    const image = createMemoryMap(0x500_0000);
    image.fill(0, 0x500_0000, 0xff);
    encodeTalkgroupsIntoAtD890Image(image, [
      { index: 1, wireName: 'TG', digitalId: 0x1234, callType: 0x04 },
    ]);
    const set = image.get(D890_MAP.TalkgroupSet, 0x4f0);
    expect(listSetBits(set, true)).toEqual([0]);
  });

  it('addresses talkgroup slots with stride 0xc8', () => {
    const image = createMemoryMap(0x500_0000);
    image.fill(0, 0x500_0000, 0xff);
    encodeTalkgroupsIntoAtD890Image(image, [
      { index: 1, wireName: 'A', digitalId: 1, callType: 0x04 },
      { index: 2, wireName: 'B', digitalId: 2, callType: 0x04 },
    ]);
    expect(image.get(D890_MAP.TalkgroupData + 0xc8, 1)[0]).toBe(0x01);
    // Slot 1 must not sit at the old wrong pitch 0xd0
    expect(image.get(D890_MAP.TalkgroupData + 0xd0, 1)[0]).not.toBe(0x01);
  });
});

describe('zone shrink on merge', () => {
  it('replaces zone membership on full modelled write', () => {
    const bag = createRadioCloneHydrationBagFromBlocks({
      radioModelId: AT_D890UV_MODEL_ID,
      addressBase: 0,
      capturedVia: 'web-serial',
      blocks: [
        { address: D890_MAP.ChannelSet, data: new Uint8Array(0x200) },
        { address: D890_MAP.ZoneSet, data: new Uint8Array(0x20) },
        { address: D890_MAP.ZoneHide, data: new Uint8Array(0x20) },
        { address: D890_MAP.ZoneAChannel, data: new Uint8Array(0x200) },
        { address: D890_MAP.ZoneBChannel, data: new Uint8Array(0x200) },
        { address: D890_MAP.ScanListSet, data: new Uint8Array(0x20) },
        { address: D890_MAP.TalkgroupSet, data: new Uint8Array(0x4f0).fill(0xff) },
        { address: D890_MAP.ReceiveGroupSet, data: new Uint8Array(0x20) },
        { address: D890_MAP.RadioIdSet, data: new Uint8Array(0x20) },
        { address: D890_MAP.MasterIdData, data: new Uint8Array(0x40) },
      ],
    });
    const channels: RadioChannelDto[] = [
      {
        slotIndex: 1,
        empty: false,
        wireName: 'CH',
        rxHz: 145_500_000,
        txHz: 145_500_000,
        rxTone: { kind: 'none' },
        txTone: { kind: 'none' },
        powerPercent: 100,
        bandwidth: 'FM',
        mode: 'analog',
      },
    ];
    const image = mergeChannelsIntoAtD890uvHydration(bag, channels, {
      zones: [{ wireName: 'New', channelNumbers: [1] }],
    });
    const members = listZoneMemberIndicesFromCache(
      {
        blocks: new Map([[D890_MAP.ZoneChannels, image.get(D890_MAP.ZoneChannels, 0x200)]]),
      },
      0,
    );
    expect(members).toEqual([0]);
  });

  it('merges organisation.aprs into AprsConfigMain', () => {
    const bag = createRadioCloneHydrationBagFromBlocks({
      radioModelId: AT_D890UV_MODEL_ID,
      blocks: [
        {
          address: D890_MAP.AprsConfigMain,
          data: new Uint8Array(D890_MAP.AprsConfigMainLength).fill(0xaa),
        },
      ],
      addressBase: 0,
      capturedVia: 'web-serial',
    });
    const image = mergeChannelsIntoAtD890uvHydration(bag, [], {
      aprs: {
        manualTxIntervalSec: 90,
        digitalSlots: [],
      },
    });
    const block = image.get(D890_MAP.AprsConfigMain, D890_MAP.AprsConfigMainLength);
    expect(block[0x0a]).toBe(90);
    expect(block[0x16]).toBe(0xaa);
  });
});
