/**
 * RT95 restoreFromBackup — rebuild the PROGRAM→QX clone from restorable zip
 * bins and upload. Does not assemble, merge channels into hydration, or seed
 * from a project bag. No isolated calibration or LocalInfo on this map.
 */

import type { RadioBackupManifestV1, RadioBackupRegionV1 } from '../../backup/types.ts';
import type { MemoryMap } from '../../types.ts';
import { RadioProtocolError } from '../../kit/errors.ts';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import { RT95_IMAGE_SIZE } from './constants.ts';

export const RT95_PROGRAMMING_IMAGE_REGION_ID = 'programming-image';

export type Rt95RestoreArchive = {
  manifest: RadioBackupManifestV1;
  image: MemoryMap;
};

function canReadArchive(image: MemoryMap, offset: number, length: number): boolean {
  return offset >= 0 && length > 0 && offset + length <= image.size;
}

function bytesForRegion(archive: Rt95RestoreArchive, region: RadioBackupRegionV1): Uint8Array {
  if (!canReadArchive(archive.image, region.address, region.byteLength)) {
    throw new RadioProtocolError(
      `RT95 restore region ${region.id} [${region.address.toString(16)}, +${region.byteLength.toString(16)}) is outside the archive image`,
    );
  }
  return archive.image.get(region.address, region.byteLength);
}

/**
 * Programming clone: selected restorable bins copied onto 0xff.
 * Unselected / inspect-only regions stay 0xff and are not programmed.
 */
export function intendedRt95RestoreImage(
  archive: Rt95RestoreArchive,
  regionIds: readonly string[],
): MemoryMap {
  const intended = createMemoryMap(RT95_IMAGE_SIZE);
  intended.fill(0, RT95_IMAGE_SIZE, 0xff);
  const selected = new Set(regionIds);
  let copied = 0;
  for (const region of archive.manifest.regions) {
    if (!selected.has(region.id)) continue;
    if (region.restoreRole !== 'restorable') continue;
    const data = bytesForRegion(archive, region);
    if (region.address + data.length > RT95_IMAGE_SIZE) {
      throw new RadioProtocolError(
        `RT95 restore region ${region.id} does not fit the 0x${RT95_IMAGE_SIZE.toString(16)} programming clone`,
      );
    }
    intended.set(region.address, data);
    copied += 1;
  }
  if (copied === 0) {
    throw new RadioProtocolError('RT95 restore has no restorable clone bins to write');
  }
  return intended;
}
