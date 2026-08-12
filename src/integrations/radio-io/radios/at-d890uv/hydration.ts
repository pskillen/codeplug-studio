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
import { cacheToMemoryMap, putCacheBytes, type AtD890DownloadCache } from './memory.ts';
import { encodeChannelsIntoAtD890Image } from './channelCodec.ts';
import { encodeZonesIntoAtD890Image } from './zoneCodec.ts';
import { encodeScanListsIntoAtD890Image } from './scanListCodec.ts';
import { encodeTalkgroupsIntoAtD890Image } from './talkGroupCodec.ts';
import { encodeRxGroupsIntoAtD890Image } from './rxGroupCodec.ts';
import { encodeRadioIdsIntoAtD890Image } from './radioIdCodec.ts';
import { encodeMasterIdIntoAtD890Image } from './masterIdCodec.ts';
import { encodeAprsIntoAtD890Image } from './aprsCodec.ts';
import { encodeAmAirIntoAtD890Image } from './amAirCodec.ts';
import { encodeAmZonesIntoAtD890Image } from './amZoneCodec.ts';
import { AT_D890UV_MODEL_IDS, AT_D890_MAP_SIZE } from './constants.ts';
import { createMemoryMap } from '../../kit/memoryMap.ts';
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

/** Encode a build projection onto a D890 memory image (no persisted hydration base). */
export function assembleAtD890WriteImage(
  channels: readonly RadioChannelDto[],
  organisation?: RadioWriteOrganisation,
): MemoryMap {
  const next = createMemoryMap(AT_D890_MAP_SIZE);
  next.fill(0, AT_D890_MAP_SIZE, 0xff);
  return encodeAtD890ProjectionOntoImage(next, channels, organisation);
}

function encodeAtD890ProjectionOntoImage(
  image: MemoryMap,
  channels: readonly RadioChannelDto[],
  organisation?: RadioWriteOrganisation,
): MemoryMap {
  let next = image;

  if (organisation?.talkGroups) {
    next = encodeTalkgroupsIntoAtD890Image(next, organisation.talkGroups);
  }
  if (organisation?.rxGroups) {
    next = encodeRxGroupsIntoAtD890Image(next, organisation.rxGroups);
  }
  next = encodeRadioIdsIntoAtD890Image(next, organisation?.radioIds ?? []);
  if (organisation?.radioIds) {
    next = encodeMasterIdIntoAtD890Image(next, organisation.radioIds);
  }
  next = encodeChannelsIntoAtD890Image(next, channels);
  if (organisation?.zones) {
    next = encodeZonesIntoAtD890Image(next, organisation.zones);
  }
  if (organisation?.scanLists) {
    next = encodeScanListsIntoAtD890Image(
      next,
      organisation.scanLists,
      organisation.atD890ScanListTiming,
    );
  }
  // Product rule (#756): AmAir and AmZone Write together, or leave both alone.
  if (organisation?.amAirChannels && organisation?.amZones) {
    next = encodeAmAirIntoAtD890Image(next, organisation.amAirChannels);
    next = encodeAmZonesIntoAtD890Image(next, organisation.amZones);
  }
  if (organisation?.aprs) {
    next = encodeAprsIntoAtD890Image(next, organisation.aprs);
  }

  return next;
}

export function mergeChannelsIntoAtD890uvHydration(
  bag: RadioCloneHydrationBag,
  channels: readonly RadioChannelDto[],
  organisation?: RadioWriteOrganisation,
): MemoryMap {
  const base = memoryMapFromAtD890uvHydration(bag);
  return encodeAtD890ProjectionOntoImage(base, channels, organisation);
}
