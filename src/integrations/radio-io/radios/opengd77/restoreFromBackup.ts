/**
 * OpenGD77 restoreFromBackup — replay archive FLASH spans vs a blank prior.
 * Does not arm a write projection, assemble, or encode the current build into FLASH.
 */

import type { RadioBackupManifestV1, RadioBackupRegionV1 } from '../../backup/types.ts';
import type { MemoryMap } from '../../types.ts';
import { RadioProtocolError } from '../../kit/errors.ts';
import {
  OPENGD77_BACKUP_FLASH_SPANS,
  isOpenGd77RestoreNeverWriteAddress,
} from './backupRestoreRoles.ts';
import { OPENUV380_IMAGE_SIZE, openUv380AbsToOffset } from './constants.ts';
import {
  collectDirtySectors,
  createOpenUv380Image,
  type DirtySector,
  writeAbs,
} from './memory.ts';

export type OpenGd77RestoreArchive = {
  manifest: RadioBackupManifestV1;
  image: MemoryMap;
};

function canReadArchive(image: MemoryMap, offset: number, length: number): boolean {
  return offset >= 0 && length > 0 && offset + length <= image.size;
}

function bytesForRegion(image: MemoryMap, region: RadioBackupRegionV1): Uint8Array {
  const offset = openUv380AbsToOffset(region.address);
  if (!canReadArchive(image, offset, region.byteLength)) {
    throw new RadioProtocolError(
      `OpenGD77 restore region ${region.id} [${region.address.toString(16)}, +${region.byteLength.toString(16)}) is outside the archive image`,
    );
  }
  return image.get(offset, region.byteLength);
}

/**
 * Overlay selected restorable FLASH spans onto a virgin 0xff OpenUV380 map.
 */
export function intendedOpenGd77RestoreImage(
  archive: OpenGd77RestoreArchive,
  regionIds: readonly string[],
): MemoryMap {
  const intended = createOpenUv380Image();
  const selected = new Set(regionIds);
  let copied = 0;
  for (const region of archive.manifest.regions) {
    if (!selected.has(region.id)) continue;
    if (region.restoreRole !== 'restorable') continue;
    if (isOpenGd77RestoreNeverWriteAddress(region.address)) continue;
    const span = OPENGD77_BACKUP_FLASH_SPANS.find((s) => s.id === region.id);
    if (!span) continue;
    const data = bytesForRegion(archive.image, region);
    writeAbs(intended, region.address, data);
    copied += 1;
  }
  if (copied === 0) {
    throw new RadioProtocolError('OpenGD77 restore has no restorable FLASH spans to write');
  }
  if (intended.size !== OPENUV380_IMAGE_SIZE) {
    throw new RadioProtocolError('OpenGD77 restore intended image is not a full OpenUV380 map');
  }
  return intended;
}

/** Dirty sectors vs empty/blank prior — not vs live FLASH and not vs an armed projection. */
export function listOpenGd77RestoreDirtySectors(
  archive: OpenGd77RestoreArchive,
  regionIds: readonly string[],
): DirtySector[] {
  const intended = intendedOpenGd77RestoreImage(archive, regionIds);
  return collectDirtySectors(createOpenUv380Image(), intended);
}
