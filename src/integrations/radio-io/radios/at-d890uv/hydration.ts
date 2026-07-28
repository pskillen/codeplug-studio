/**
 * Bridge MemoryMap ↔ egress radio-clone hydration for AT-D890UV (sparse blocks).
 */

import {
  createRadioCloneHydrationBagFromBlocks,
  radioCloneSparseBlockBytes,
  type RadioCloneHydrationBag,
} from '@core/models/radioCloneHydration.ts';
import type { MemoryMap } from '../../types.ts';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import type { RadioWriteOrganisation } from '../../radioWriteProjection.ts';
import { cacheToMemoryMap, putCacheBytes, clearAmAirBankBlocksFromCache, type AtD890DownloadCache } from './memory.ts';
import { encodeChannelsIntoAtD890Image, syncChannelRegionsToCache } from './channelCodec.ts';
import { encodeZonesIntoAtD890Image, syncZoneRegionsToCache } from './zoneCodec.ts';
import { encodeScanListsIntoAtD890Image, syncScanListRegionsToCache } from './scanListCodec.ts';
import { encodeTalkgroupsIntoAtD890Image, syncTalkgroupRegionsToCache } from './talkGroupCodec.ts';
import { encodeRxGroupsIntoAtD890Image, syncRxGroupRegionsToCache } from './rxGroupCodec.ts';
import { encodeRadioIdsIntoAtD890Image, syncRadioIdRegionsToCache } from './radioIdCodec.ts';
import { encodeMasterIdIntoAtD890Image, syncMasterIdToCache } from './masterIdCodec.ts';
import { encodeAmAirIntoAtD890Image, syncAmAirRegionsToCache } from './amAirCodec.ts';
import { encodeAmZonesIntoAtD890Image, syncAmZoneRegionsToCache } from './amZoneCodec.ts';
import { AT_D890UV_MODEL_IDS } from './constants.ts';
import type { AtD890DownloadCache as ProtocolCache } from './protocol.ts';

export const AT_D890UV_MODEL_ID = AT_D890UV_MODEL_IDS[0];

export function cacheFromBag(bag: RadioCloneHydrationBag): AtD890DownloadCache {
  const cache: AtD890DownloadCache = {
    firmware: bag.retain.firmware,
    blocks: new Map(),
  };
  for (const b of radioCloneSparseBlockBytes(bag)) {
    // Normalize to 16-byte keys (bags may still hold longer Read blobs).
    putCacheBytes(cache, b.address, b.data);
  }
  return cache;
}

export function memoryMapFromAtD890uvHydration(bag: RadioCloneHydrationBag): MemoryMap {
  return cacheToMemoryMap(cacheFromBag(bag));
}

export function extractAtD890uvHydration(
  image: MemoryMap,
  meta?: { sourceFileName?: string; capturedAt?: string; cache?: ProtocolCache },
): RadioCloneHydrationBag {
  const cache = meta?.cache;
  if (!cache || cache.blocks.size === 0) {
    const blocks = [{ address: 0, data: image.bytes.slice() }];
    return createRadioCloneHydrationBagFromBlocks({
      radioModelId: AT_D890UV_MODEL_ID,
      blocks,
      addressBase: 0,
      capturedVia: 'web-serial',
      sourceFileName: meta?.sourceFileName,
      capturedAt: meta?.capturedAt,
    });
  }
  const blockList = [...cache.blocks.entries()].map(([address, data]) => ({
    address,
    data: data.slice(),
  }));
  return createRadioCloneHydrationBagFromBlocks({
    radioModelId: AT_D890UV_MODEL_ID,
    blocks: blockList,
    addressBase: 0,
    firmware: cache.firmware,
    capturedVia: 'web-serial',
    sourceFileName: meta?.sourceFileName,
    capturedAt: meta?.capturedAt,
  });
}

export function extractAtD890uvHydrationFromProtocol(
  image: MemoryMap,
  cache: ProtocolCache,
  meta?: { sourceFileName?: string; capturedAt?: string },
): RadioCloneHydrationBag {
  return extractAtD890uvHydration(image, { ...meta, cache });
}

export function mergeChannelsIntoAtD890uvHydration(
  bag: RadioCloneHydrationBag,
  channels: readonly RadioChannelDto[],
  organisation?: RadioWriteOrganisation,
): MemoryMap {
  const cache = cacheFromBag(bag);
  const image = memoryMapFromAtD890uvHydration(bag);

  let next = image;
  if (organisation?.talkGroups) {
    next = encodeTalkgroupsIntoAtD890Image(next, organisation.talkGroups);
  }
  if (organisation?.rxGroups) {
    next = encodeRxGroupsIntoAtD890Image(next, organisation.rxGroups);
  }
  if (organisation?.radioIds) {
    next = encodeRadioIdsIntoAtD890Image(next, organisation.radioIds);
    next = encodeMasterIdIntoAtD890Image(next, organisation.radioIds);
  }
  next = encodeChannelsIntoAtD890Image(next, channels);
  if (organisation?.zones) {
    next = encodeZonesIntoAtD890Image(next, organisation.zones);
  }
  if (organisation?.scanLists) {
    next = encodeScanListsIntoAtD890Image(next, organisation.scanLists);
  }
  // Product rule (#756): AmAir and AmZone Write together, or leave both alone.
  // Always drop prior Read/cache airband blocks first so retain does not re-stage
  // them, and a shrink does not leave stale occupied-slot bodies on the allow-list.
  clearAmAirBankBlocksFromCache(cache);
  if (organisation?.amAirChannels && organisation?.amZones) {
    next = encodeAmAirIntoAtD890Image(next, organisation.amAirChannels);
    next = encodeAmZonesIntoAtD890Image(next, organisation.amZones);
  }

  syncTalkgroupRegionsToCache(cache, next, organisation?.talkGroups);
  syncRxGroupRegionsToCache(cache, next);
  syncRadioIdRegionsToCache(cache, next);
  syncMasterIdToCache(cache, next);
  syncChannelRegionsToCache(cache, next);
  syncZoneRegionsToCache(cache, next);
  syncScanListRegionsToCache(cache, next);
  if (organisation?.amAirChannels && organisation?.amZones) {
    syncAmAirRegionsToCache(cache, next);
    syncAmZoneRegionsToCache(cache, next);
  }

  return next;
}
