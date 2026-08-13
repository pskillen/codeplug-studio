/**
 * AT-D890UV clone summary inspect-list tests (fixture bags only).
 */

import { describe, expect, it } from 'vitest';
import { createRadioCloneHydrationBagFromBlocks } from '@core/models/radioCloneHydration.ts';
import { setBitmapBit } from './bitmap.ts';
import { encodeAtD890ChannelRecord } from './channelCodec.ts';
import { summariseAtD890uvClone } from './cloneSummary.ts';
import { AT_D890_LIMITS, D890_MAP } from './constants.ts';
import { AT_D890UV_MODEL_ID } from './hydration.ts';
import {
  channelPrimaryAddress,
  channelSecondaryAddress,
  putCacheBytes,
  zoneNameAddress,
  type AtD890DownloadCache,
} from './memory.ts';
import { encodeWideCharName } from './wideChar.ts';

function bagFromCache(cache: AtD890DownloadCache) {
  return createRadioCloneHydrationBagFromBlocks({
    radioModelId: AT_D890UV_MODEL_ID,
    blocks: [...cache.blocks.entries()].map(([address, data]) => ({ address, data })),
    capturedVia: 'web-serial',
  });
}

describe('summariseAtD890uvClone inspect lists', () => {
  it('lists occupied channel and zone names from the sparse cache', () => {
    const cache: AtD890DownloadCache = { blocks: new Map() };
    const channelSet = new Uint8Array(AT_D890_LIMITS.CHANNEL_SET_BYTES);
    setBitmapBit(channelSet, 0, true);
    putCacheBytes(cache, D890_MAP.ChannelSet, channelSet);
    const encoded = encodeAtD890ChannelRecord({
      slotIndex: 1,
      empty: false,
      wireName: 'LocalRpt',
      rxHz: 145_520_000,
      txHz: 145_520_000,
      rxTone: { kind: 'none' },
      txTone: { kind: 'none' },
      powerPercent: 100,
      bandwidth: 'FM',
      mode: 'analog',
    });
    putCacheBytes(
      cache,
      channelPrimaryAddress(0),
      encoded.subarray(0, AT_D890_LIMITS.CHANNEL_CHUNK_SIZE),
    );
    putCacheBytes(
      cache,
      channelSecondaryAddress(0),
      encoded.subarray(AT_D890_LIMITS.CHANNEL_CHUNK_SIZE),
    );

    const zoneSet = new Uint8Array(AT_D890_LIMITS.ZONE_SET_BYTES);
    setBitmapBit(zoneSet, 0, true);
    putCacheBytes(cache, D890_MAP.ZoneSet, zoneSet);
    putCacheBytes(cache, zoneNameAddress(0), encodeWideCharName('City', D890_MAP.ZoneDataLength));
    putCacheBytes(cache, D890_MAP.LocalInfo, new Uint8Array(D890_MAP.LocalInfoLength));

    const summary = summariseAtD890uvClone(bagFromCache(cache));
    expect(summary?.inspectChannels).toEqual([{ slotIndex: 1, name: 'LocalRpt' }]);
    expect(summary?.inspectZones).toEqual([{ slotIndex: 1, name: 'City' }]);
    expect(summary?.localInfoRegisters.length).toBeGreaterThan(0);
  });
});
