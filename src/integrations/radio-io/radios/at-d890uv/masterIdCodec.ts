/**
 * AT-D890UV master / default radio ID @ MasterIdData.
 */

import type { MemoryMap } from '../../types.ts';
import type { RadioRadioIdDto } from '../../radioWriteProjection.ts';
import { D890_MAP } from './constants.ts';
import { mergeMapRegionsIntoCache, putCacheBytes, type AtD890DownloadCache } from './memory.ts';
import { encodeAtD890RadioIdRecord } from './radioIdCodec.ts';

export function encodeMasterIdIntoAtD890Image(
  image: MemoryMap,
  radioIds: readonly RadioRadioIdDto[],
): MemoryMap {
  const master = radioIds[0];
  if (!master || master.dmrId <= 0) {
    return image;
  }
  image.set(
    D890_MAP.MasterIdData,
    encodeAtD890RadioIdRecord(master).subarray(0, D890_MAP.MasterIdLength),
  );
  return image;
}

export function syncMasterIdToCache(cache: AtD890DownloadCache, image: MemoryMap): void {
  mergeMapRegionsIntoCache(cache, image, [
    { address: D890_MAP.MasterIdData, length: D890_MAP.MasterIdLength },
  ]);
  putCacheBytes(
    cache,
    D890_MAP.MasterIdData,
    image.get(D890_MAP.MasterIdData, D890_MAP.MasterIdLength),
  );
}
