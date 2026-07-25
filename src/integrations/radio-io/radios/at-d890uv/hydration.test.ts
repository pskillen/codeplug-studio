import { describe, expect, it } from 'vitest';
import { D890_MAP } from './constants.ts';
import { cacheFromBag, mergeChannelsIntoAtD890uvHydration } from './hydration.ts';
import { createRadioCloneHydrationBagFromBlocks } from '@core/models/radioCloneHydration.ts';
import { AT_D890UV_MODEL_ID } from './hydration.ts';
import { listSetBits } from './bitmap.ts';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import { encodeBcdFrequencyHz } from './bcd.ts';
import { channelPrimaryAddress } from './memory.ts';

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

describe('cacheFromBag', () => {
  it('rehydrates sparse blocks from bag', () => {
    const bag = minimalHydrationBag();
    const cache = cacheFromBag(bag);
    expect(cache.blocks.size).toBeGreaterThan(5);
  });
});
