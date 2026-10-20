import { describe, expect, it } from 'vitest';
import { AT_D890UV_LIMITS } from '@core/radios/anytone/at-d890uv/limits.ts';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import { AT_D890_LIMITS, AT_D890_MAP_SIZE, D890_MAP } from './constants.ts';
import { eraseUnitBaseFor } from './eraseUnits.ts';
import {
  alignedSpanForAtD890Region,
  applyAtD890WriteImageToCache,
  clearTalkgroupDataBlocksFromCache,
  getCacheBytes,
  listWriteChunks,
  putCacheBytes,
  scanListAddress,
  talkgroupAddress,
  type AtD890DownloadCache,
} from './memory.ts';
import { encodeTalkgroupsIntoAtD890Image } from './talkGroupCodec.ts';
import { encodeAmAirIntoAtD890Image } from './amAirCodec.ts';
import { encodeAmZonesIntoAtD890Image } from './amZoneCodec.ts';
import { createRadioCloneHydrationBagFromBlocks } from '@core/models/radioCloneHydration.ts';
import {
  AT_D890UV_MODEL_ID,
  cacheFromBag,
  mergeChannelsIntoAtD890uvHydration,
} from './hydration.ts';

describe('scanListAddress', () => {
  it('places list 32 at the next bank, not the byte after bank 0', () => {
    expect(scanListAddress(0)).toBe(0x210_0000);
    expect(scanListAddress(31)).toBe(0x210_3e00);
    expect(scanListAddress(32)).toBe(0x218_0000);
    expect(scanListAddress(33)).toBe(0x218_0200);
  });
});

describe('talkgroupAddress', () => {
  it('places slot 1000 at the next bank, not the byte after bank 0', () => {
    expect(talkgroupAddress(0)).toBe(0x3a0_0000);
    expect(talkgroupAddress(1)).toBe(D890_MAP.TalkgroupData + 0xc8);
    expect(talkgroupAddress(999)).toBe(0x3a3_0c78);
    expect(talkgroupAddress(1000)).toBe(0x3a8_0000);
    expect(talkgroupAddress(1000)).not.toBe(0x3a3_0d40);
    expect(talkgroupAddress(4000)).toBe(0x3c0_0000);
    expect(talkgroupAddress(9999)).toBe(0x3eb_0c78);
  });
});

describe('alignedSpanForAtD890Region', () => {
  it('covers odd talkgroup slots that are not 16-aligned', () => {
    const slot1 = talkgroupAddress(1);
    expect(slot1).toBe(D890_MAP.TalkgroupData + 0xc8);
    expect(slot1 % 16).toBe(8);
    const span = alignedSpanForAtD890Region(slot1, AT_D890_LIMITS.TALKGROUP_RECORD_SIZE);
    expect(span.start).toBe(D890_MAP.TalkgroupData + 0xc0);
    expect(span.start % 16).toBe(0);
    expect(span.length % 16).toBe(0);
    expect(span.start + span.length).toBeGreaterThanOrEqual(
      slot1 + AT_D890_LIMITS.TALKGROUP_RECORD_SIZE,
    );
  });
});

describe('talkgroup cache merge', () => {
  it('writes odd-index talkgroups without unaligned putCacheBytes', () => {
    const image = createMemoryMap(AT_D890_MAP_SIZE);
    image.fill(0, AT_D890_MAP_SIZE, 0xff);
    encodeTalkgroupsIntoAtD890Image(image, [
      { index: 1, wireName: 'A', digitalId: 1, callType: 0x04 },
      { index: 2, wireName: 'B', digitalId: 2, callType: 0x04 },
    ]);

    const cache: AtD890DownloadCache = {
      blocks: new Map([
        // Stale block from pre-fix 0xd0 stride Read
        [D890_MAP.TalkgroupData + 0xd0, new Uint8Array(16).fill(0xaa)],
      ]),
    };
    applyAtD890WriteImageToCache(cache, image);

    // 0xd0 is a valid 16-byte key inside slot 1's aligned span; stale 0xaa must be gone.
    expect(cache.blocks.get(D890_MAP.TalkgroupData + 0xd0)![0]).not.toBe(0xaa);
    expect(cache.blocks.has(D890_MAP.TalkgroupData + 0xc0)).toBe(true);
    const slot1 = getCacheBytes(cache, talkgroupAddress(1), 1);
    expect(slot1[0]).toBe(0x01);
  });

  it('clearTalkgroupDataBlocksFromCache removes bank keys only', () => {
    const cache: AtD890DownloadCache = {
      blocks: new Map([
        [D890_MAP.TalkgroupData, new Uint8Array(16)],
        [D890_MAP.TalkgroupData + 0xd0, new Uint8Array(16)],
        [D890_MAP.LocalInfo, new Uint8Array(16)],
      ]),
    };
    clearTalkgroupDataBlocksFromCache(cache);
    expect(cache.blocks.has(D890_MAP.TalkgroupData)).toBe(false);
    expect(cache.blocks.has(D890_MAP.TalkgroupData + 0xd0)).toBe(false);
    expect(cache.blocks.has(D890_MAP.LocalInfo)).toBe(true);
  });
});

describe('putCacheBytes', () => {
  it('splits long blobs into 16-byte keys', () => {
    const cache: AtD890DownloadCache = { blocks: new Map() };
    const data = new Uint8Array(0x30);
    data[0] = 1;
    data[0x10] = 2;
    data[0x20] = 3;
    putCacheBytes(cache, 0x1000, data);
    expect(cache.blocks.get(0x1000)![0]).toBe(1);
    expect(cache.blocks.get(0x1010)![0]).toBe(2);
    expect(cache.blocks.get(0x1020)![0]).toBe(3);
  });
});

describe('getCacheBytes unaligned', () => {
  it('assembles across 16-byte keys for a mid-block start', () => {
    const cache: AtD890DownloadCache = { blocks: new Map() };
    const block = new Uint8Array(16);
    block[8] = 0x01;
    putCacheBytes(cache, D890_MAP.TalkgroupData + 0xc0, block);
    expect(getCacheBytes(cache, talkgroupAddress(1), 1)[0]).toBe(0x01);
  });
});

function minimalD890HydrationBag() {
  return createRadioCloneHydrationBagFromBlocks({
    radioModelId: AT_D890UV_MODEL_ID,
    addressBase: 0,
    capturedVia: 'web-serial',
    blocks: [
      { address: D890_MAP.LocalInfo, data: new Uint8Array(0x100).fill(0xff) },
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
}

describe('applyAtD890WriteImageToCache bank intent', () => {
  it('stages TalkgroupOrder when replaceTalkgroupOrder is set', () => {
    const bag = minimalD890HydrationBag();
    const cache = cacheFromBag(bag);
    const image = mergeChannelsIntoAtD890uvHydration(bag, [], {
      talkGroups: [{ index: 1, wireName: 'TG1', digitalId: 1234, callType: 0x04 }],
    });
    applyAtD890WriteImageToCache(cache, image, {
      replaceAmAirBank: false,
      replaceTalkgroupOrder: true,
    });
    const chunks = listWriteChunks(cache);
    const addresses = new Set(chunks.map((c) => c.address));
    expect(addresses.has(D890_MAP.TalkgroupOrder)).toBe(true);
  });

  it('replaces a factory position-table prefix already in the download cache', () => {
    const talkGroups = [
      { index: 1, wireName: 'TG1', digitalId: 9, callType: 0x04 },
      { index: 2, wireName: 'TG2', digitalId: 99, callType: 0x04 },
      { index: 3, wireName: 'TG3', digitalId: 235, callType: 0x04 },
    ];
    const bag = minimalD890HydrationBag();
    const cache = cacheFromBag(bag);
    const factory = new Uint8Array(16);
    factory.set([0x00, 0x00, 0x00, 0x00]);
    factory.fill(0xff, 4);
    cache.blocks.set(D890_MAP.TalkgroupPosition, factory);
    // A short block that is not a 16-byte cache key. Clearing the span must drop it.
    cache.blocks.set(D890_MAP.TalkgroupPosition + 4, new Uint8Array([0x00, 0x00, 0x00, 0x00]));

    const image = mergeChannelsIntoAtD890uvHydration(bag, [], { talkGroups });
    applyAtD890WriteImageToCache(cache, image, {
      replaceAmAirBank: false,
      replaceTalkgroupOrder: true,
    });

    const word = (index: number) => [
      ...getCacheBytes(cache, D890_MAP.TalkgroupPosition + index * 4, 4),
    ];
    expect(word(0)).toEqual([0x00, 0x00, 0x00, 0x00]);
    expect(word(1)).toEqual([0x01, 0x00, 0x00, 0x00]);
    expect(word(2)).toEqual([0x02, 0x00, 0x00, 0x00]);
    expect(word(3)).toEqual([0xff, 0xff, 0xff, 0xff]);
    expect(word(AT_D890UV_LIMITS.TALK_GROUPS_MAX - 1)).toEqual([0xff, 0xff, 0xff, 0xff]);

    const chunks = listWriteChunks(cache);
    const covers = (address: number) =>
      chunks.some(
        (chunk) => address >= chunk.address && address < chunk.address + chunk.data.length,
      );
    expect(covers(0x394_0000)).toBe(false);
    expect(chunks.some((chunk) => chunk.address === D890_MAP.TalkgroupPosition + 4)).toBe(false);
    const unit = eraseUnitBaseFor(D890_MAP.TalkgroupPosition);
    expect(covers(unit + 0x3_fdf8)).toBe(false);
    expect(covers(unit + 0x3_fffc)).toBe(false);
  });

  it('stages AmAir/AmZone when replaceAmAirBank is set', () => {
    const bag = minimalD890HydrationBag();
    const cache = cacheFromBag(bag);
    const image = mergeChannelsIntoAtD890uvHydration(bag, [], {
      amAirChannels: [{ slotIndex: 1, wireName: 'Tower', rxHz: 118_000_000 }],
      amZones: [
        {
          wireName: 'Air',
          channelNumbers: [1],
          aChannelMemberIndex: 0,
        },
      ],
    });
    applyAtD890WriteImageToCache(cache, image, {
      replaceAmAirBank: true,
      replaceTalkgroupOrder: false,
    });
    const chunks = listWriteChunks(cache);
    const addresses = new Set(chunks.map((c) => c.address));
    expect(addresses.has(D890_MAP.AmAirSet)).toBe(true);
    expect(addresses.has(D890_MAP.AmZoneSet)).toBe(true);
  });

  it('does not stage AmAir when replaceAmAirBank is false', () => {
    const bag = minimalD890HydrationBag();
    const cache = cacheFromBag(bag);
    const image = createMemoryMap(AT_D890_MAP_SIZE);
    image.fill(0, AT_D890_MAP_SIZE, 0xff);
    encodeAmAirIntoAtD890Image(image, [{ slotIndex: 1, wireName: 'Tower', rxHz: 118_000_000 }]);
    encodeAmZonesIntoAtD890Image(image, [
      {
        wireName: 'Air',
        channelNumbers: [1],
        aChannelMemberIndex: 0,
      },
    ]);
    applyAtD890WriteImageToCache(cache, image, {
      replaceAmAirBank: false,
      replaceTalkgroupOrder: false,
    });
    const chunks = listWriteChunks(cache);
    const addresses = new Set(chunks.map((c) => c.address));
    expect(addresses.has(D890_MAP.AmAirSet)).toBe(false);
    expect(addresses.has(D890_MAP.AmZoneSet)).toBe(false);
  });
});

describe('applyAtD890WriteImageToCache APRS (#884)', () => {
  /** VFO A sentinel — radio default for unused digital report slots. */
  const VFO_A_WIRE = 0x0fa0;

  it('stages patched AprsConfigMain digital report slots into listWriteChunks', () => {
    // Stale Read cache: slots look like VFO A (hardware symptom in #884).
    const stale = new Uint8Array(D890_MAP.AprsConfigMainLength).fill(0xaa);
    for (let i = 0; i < 8; i++) {
      stale[0x40 + i * 2] = VFO_A_WIRE & 0xff;
      stale[0x41 + i * 2] = (VFO_A_WIRE >> 8) & 0xff;
    }
    const bag = createRadioCloneHydrationBagFromBlocks({
      radioModelId: AT_D890UV_MODEL_ID,
      addressBase: 0,
      capturedVia: 'web-serial',
      blocks: [
        { address: D890_MAP.LocalInfo, data: new Uint8Array(0x100).fill(0xff) },
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
        { address: D890_MAP.AprsConfigMain, data: stale },
      ],
    });
    const cache = cacheFromBag(bag);

    // Expected wires from operator CSV / #884 handover repro.
    const image = mergeChannelsIntoAtD890uvHydration(bag, [], {
      aprs: {
        digitalSlots: [
          { reportChannelWire: 0x0fa2, targetDmrId: null, callType: 0, timeslot: 0 },
          { reportChannelWire: 49, targetDmrId: null, callType: 0, timeslot: 0 },
          { reportChannelWire: 39, targetDmrId: null, callType: 0, timeslot: 0 },
          { reportChannelWire: 107, targetDmrId: null, callType: 0, timeslot: 0 },
          { reportChannelWire: 69, targetDmrId: null, callType: 0, timeslot: 0 },
          { reportChannelWire: 91, targetDmrId: null, callType: 0, timeslot: 0 },
        ],
      },
    });

    applyAtD890WriteImageToCache(cache, image);

    const fromCache = getCacheBytes(cache, D890_MAP.AprsConfigMain, D890_MAP.AprsConfigMainLength);
    expect(fromCache[0x40]).toBe(0xa2);
    expect(fromCache[0x41]).toBe(0x0f);
    expect(fromCache[0x42]).toBe(49);
    expect(fromCache[0x43]).toBe(0);
    expect(fromCache[0x44]).toBe(39);
    expect(fromCache[0x48]).toBe(69);
    expect(fromCache[0x4a]).toBe(91);

    const slotBlockAddr = D890_MAP.AprsConfigMain + 0x40;
    const chunk = listWriteChunks(cache).find((c) => c.address === slotBlockAddr);
    expect(chunk).toBeDefined();
    expect(chunk!.data[0]).toBe(0xa2);
    expect(chunk!.data[1]).toBe(0x0f);
    expect(chunk!.data[2]).toBe(49);
    expect(chunk!.data[3]).toBe(0);
    expect(chunk!.data[4]).toBe(39);
  });
});
