/**
 * AT-D890UV master / default radio ID @ MasterIdData.
 */

import type { MemoryMap } from '../../types.ts';
import type { RadioRadioIdDto } from '../../radioWriteProjection.ts';
import { D890_MAP } from './constants.ts';
import { mergeMapRegionsIntoCache, putCacheBytes, type AtD890DownloadCache } from './memory.ts';
import { encodeBcdAsHexU32 } from './bcd.ts';
import { encodeWideCharName } from './wideChar.ts';

/** CPS master name is `0x20` bytes at `+4`. `+0x26` and every other byte stay. */
const MASTER_ID_NAME_BYTES = 0x20;

export function encodeMasterIdIntoAtD890Image(
  image: MemoryMap,
  radioIds: readonly RadioRadioIdDto[],
): MemoryMap {
  const master = radioIds[0];
  if (!master || master.dmrId <= 0) {
    return image;
  }
  const data = image.get(D890_MAP.MasterIdData, D890_MAP.MasterIdLength);
  data.set(encodeBcdAsHexU32(master.dmrId), 0);
  data.set(encodeWideCharName(master.name, MASTER_ID_NAME_BYTES), 4);
  image.set(D890_MAP.MasterIdData, data);
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
