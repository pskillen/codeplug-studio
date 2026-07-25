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

describe('zoneCodec', () => {
  it('clears removed zone membership with 0xFFFF fillers', () => {
    const image = createMemoryMap(0x500_0000);
    image.fill(0, 0x500_0000, 0xff);
    encodeZonesIntoAtD890Image(image, [{ wireName: 'Z1', channelNumbers: [1, 2] }]);
    const members = image.get(D890_MAP.ZoneChannels, 0x200);
    expect(members[0]).toBe(1);
    expect(members[1]).toBe(0);
    expect(members[2]).toBe(2);
    expect(members[3]).toBe(0);
    expect(members[4]).toBe(0xff);
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
        { address: D890_MAP.ReceiveGroupSet, data: new Uint8Array(0x10) },
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
    expect(members).toEqual([1]);
  });
});
