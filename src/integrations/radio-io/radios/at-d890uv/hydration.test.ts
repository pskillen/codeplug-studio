import { describe, expect, it } from 'vitest';
import {
  cacheFromBag,
  mergeChannelsIntoAtD890uvHydration,
  encodeAtD890WriteImageFromDownloadCache,
  AT_D890_EMPTY_WRITE_CACHE_MESSAGE,
} from './hydration.ts';
import { AT_D890_LIMITS, D890_MAP } from './constants.ts';
import { createRadioCloneHydrationBagFromBlocks } from '@core/models/radioCloneHydration.ts';
import { AT_D890UV_MODEL_ID } from './hydration.ts';
import { listSetBits } from './bitmap.ts';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import { encodeBcdFrequencyHz } from './bcd.ts';
import {
  channelPrimaryAddress,
  channelSecondaryAddress,
  putCacheBytes,
  radioIdAddress,
  type AtD890DownloadCache,
} from './memory.ts';
import { AT_D890_ZERO_VISIBLE_ZONES_MESSAGE } from './zoneCodec.ts';

function minimalHydrationBag(): ReturnType<typeof createRadioCloneHydrationBagFromBlocks> {
  const channelSet = new Uint8Array(0x200);
  const local = new Uint8Array(0x100).fill(0xff);
  const zoneSet = new Uint8Array(0x20);
  const zoneHide = new Uint8Array(0x20);
  const zoneA = new Uint8Array(0x200);
  const zoneB = new Uint8Array(0x200);
  const scanSet = new Uint8Array(0x20);
  const tgSet = new Uint8Array(0x4f0).fill(0xff);
  const rxSet = new Uint8Array(0x10);
  const ridSet = new Uint8Array(0x20);
  const master = new Uint8Array(0x40);
  return createRadioCloneHydrationBagFromBlocks({
    radioModelId: AT_D890UV_MODEL_ID,
    addressBase: 0,
    capturedVia: 'web-serial',
    blocks: [
      { address: D890_MAP.LocalInfo, data: local },
      { address: D890_MAP.ChannelSet, data: channelSet },
      { address: D890_MAP.ZoneSet, data: zoneSet },
      { address: D890_MAP.ZoneHide, data: zoneHide },
      { address: D890_MAP.ZoneAChannel, data: zoneA },
      { address: D890_MAP.ZoneBChannel, data: zoneB },
      { address: D890_MAP.ScanListSet, data: scanSet },
      { address: D890_MAP.TalkgroupSet, data: tgSet },
      { address: D890_MAP.ReceiveGroupSet, data: rxSet },
      { address: D890_MAP.RadioIdSet, data: ridSet },
      { address: D890_MAP.MasterIdData, data: master },
    ],
  });
}

describe('mergeChannelsIntoAtD890uvHydration', () => {
  it('merges channels and sets ChannelSet bit', () => {
    const bag = minimalHydrationBag();
    const channels: RadioChannelDto[] = [
      {
        slotIndex: 1,
        empty: false,
        wireName: 'CH1',
        rxHz: 145_500_000,
        txHz: 145_500_000,
        rxTone: { kind: 'none' },
        txTone: { kind: 'none' },
        powerPercent: 100,
        bandwidth: 'FM',
        mode: 'analog',
      },
    ];
    const image = mergeChannelsIntoAtD890uvHydration(bag, channels);
    const set = image.get(D890_MAP.ChannelSet, 0x200);
    expect(listSetBits(set)).toEqual([0]);
    const primary = image.get(channelPrimaryAddress(0), 0x40);
    expect(primary.subarray(0, 4)).toEqual(encodeBcdFrequencyHz(145_500_000));
  });

  it('FK merge order: talkgroups before channels', () => {
    const bag = minimalHydrationBag();
    const channels: RadioChannelDto[] = [
      {
        slotIndex: 1,
        empty: false,
        wireName: 'DMR',
        rxHz: 430_000_000,
        txHz: 430_000_000,
        rxTone: { kind: 'none' },
        txTone: { kind: 'none' },
        powerPercent: 100,
        bandwidth: 'FM',
        mode: 'digital',
        txContactId: 1,
      },
    ];
    const image = mergeChannelsIntoAtD890uvHydration(bag, channels, {
      talkGroups: [{ index: 1, wireName: 'TG1', digitalId: 1234, callType: 0x04 }],
    });
    const tgSet = image.get(D890_MAP.TalkgroupSet, 0x4f0);
    expect(listSetBits(tgSet, true)).toEqual([0]);
  });
});

describe('encodeAtD890WriteImageFromDownloadCache', () => {
  const analogCh: RadioChannelDto = {
    slotIndex: 1,
    empty: false,
    wireName: 'CH1',
    rxHz: 145_500_000,
    txHz: 145_500_000,
    rxTone: { kind: 'none' },
    txTone: { kind: 'none' },
    powerPercent: 100,
    bandwidth: 'FM',
    mode: 'analog',
  };

  function seedLivePriorCache(aesByte = 0x00): AtD890DownloadCache {
    const cache: AtD890DownloadCache = { blocks: new Map() };
    const radioIdSet = new Uint8Array(AT_D890_LIMITS.RADIO_ID_SET_BYTES);
    radioIdSet[0] = 0x01;
    putCacheBytes(cache, D890_MAP.RadioIdSet, radioIdSet);
    const record = new Uint8Array(AT_D890_LIMITS.RADIO_ID_STRIDE);
    record[0] = 0xaa;
    record[1] = 0xbb;
    putCacheBytes(cache, radioIdAddress(0), record);
    const master = new Uint8Array(D890_MAP.MasterIdLength);
    master[0] = 0xcc;
    putCacheBytes(cache, D890_MAP.MasterIdData, master);
    const channelSet = new Uint8Array(AT_D890_LIMITS.CHANNEL_SET_BYTES);
    channelSet.fill(0x03, AT_D890_LIMITS.CHANNEL_SET_BYTES - 12);
    putCacheBytes(cache, D890_MAP.ChannelSet, channelSet);
    const primary = new Uint8Array(AT_D890_LIMITS.CHANNEL_CHUNK_SIZE);
    primary[0x22] = aesByte;
    putCacheBytes(cache, channelPrimaryAddress(0), primary);
    putCacheBytes(
      cache,
      channelSecondaryAddress(0),
      new Uint8Array(AT_D890_LIMITS.CHANNEL_CHUNK_SIZE),
    );
    putCacheBytes(cache, D890_MAP.ZoneSet, new Uint8Array(AT_D890_LIMITS.ZONE_SET_BYTES));
    putCacheBytes(
      cache,
      D890_MAP.ZoneHide,
      new Uint8Array(AT_D890_LIMITS.ZONE_SET_BYTES).fill(0xff),
    );
    putCacheBytes(
      cache,
      D890_MAP.TalkgroupSet,
      new Uint8Array(AT_D890_LIMITS.TALKGROUP_SET_BYTES).fill(0xff),
    );
    return cache;
  }

  it('preserves radio IDs, ChannelSet tail, channel AES, and clears occupied ZoneHide', () => {
    const image = encodeAtD890WriteImageFromDownloadCache(seedLivePriorCache(0x00), [analogCh], {
      radioIds: [],
      zones: [{ wireName: 'Z1', channelNumbers: [1] }],
    });
    expect(image.get(D890_MAP.RadioIdSet, AT_D890_LIMITS.RADIO_ID_SET_BYTES)[0]).toBe(0x01);
    expect(image.get(radioIdAddress(0), AT_D890_LIMITS.RADIO_ID_STRIDE)[0]).toBe(0xaa);
    expect(image.get(D890_MAP.MasterIdData, D890_MAP.MasterIdLength)[0]).toBe(0xcc);
    const channelSet = image.get(D890_MAP.ChannelSet, AT_D890_LIMITS.CHANNEL_SET_BYTES);
    expect(channelSet.subarray(AT_D890_LIMITS.CHANNEL_SET_BYTES - 12)).toEqual(
      new Uint8Array(12).fill(0x03),
    );
    expect(image.get(channelPrimaryAddress(0), AT_D890_LIMITS.CHANNEL_CHUNK_SIZE)[0x22]).toBe(0x00);
    expect(image.get(D890_MAP.ZoneHide, AT_D890_LIMITS.ZONE_SET_BYTES)[0]! & 1).toBe(0);
  });

  it('preserves seeded AES 0xfd when the DTO does not model it', () => {
    const image = encodeAtD890WriteImageFromDownloadCache(seedLivePriorCache(0xfd), [analogCh], {
      radioIds: [],
      zones: [{ wireName: 'Z1', channelNumbers: [1] }],
    });
    expect(image.get(channelPrimaryAddress(0), AT_D890_LIMITS.CHANNEL_CHUNK_SIZE)[0x22]).toBe(0xfd);
  });

  it('refuses an empty download cache instead of assembling 0xff', () => {
    expect(() =>
      encodeAtD890WriteImageFromDownloadCache({ blocks: new Map() }, [analogCh], {
        zones: [{ wireName: 'Z1', channelNumbers: [1] }],
      }),
    ).toThrow(AT_D890_EMPTY_WRITE_CACHE_MESSAGE);
  });

  it('refuses zero visible zones', () => {
    expect(() =>
      encodeAtD890WriteImageFromDownloadCache(seedLivePriorCache(), [analogCh], {
        radioIds: [],
        zones: [],
      }),
    ).toThrow(AT_D890_ZERO_VISIBLE_ZONES_MESSAGE);
  });
});

describe('cacheFromBag', () => {
  it('rehydrates sparse blocks from bag', () => {
    const bag = minimalHydrationBag();
    const cache = cacheFromBag(bag);
    expect(cache.blocks.size).toBeGreaterThan(5);
  });
});
