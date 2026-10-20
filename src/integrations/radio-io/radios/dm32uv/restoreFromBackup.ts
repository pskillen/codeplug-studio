/**
 * DM-32UV restoreFromBackup — replay restorable 4KB archive blocks.
 * Does not assemble, remap after factory reset, merge channels, or write
 * calibration (metadata 0x02).
 */

import type { RadioBackupManifestV1, RadioBackupRegionV1 } from '../../backup/types.ts';
import type { MemoryMap } from '../../types.ts';
import { RadioProtocolError } from '../../kit/errors.ts';
import {
  DM32_BLOCK_SIZE,
  DM32_FACTORY_SECTOR_ADDRESS,
  DM32_METADATA,
  DM32_METADATA_OFFSET,
} from './constants.ts';
import { isDm32RestoreNeverWriteBlock } from './backupRestoreRoles.ts';
import { selectDm32CalibrationPages, type Dm32ConfigWindow } from './memory.ts';

export type Dm32RestoreArchive = {
  manifest: RadioBackupManifestV1;
  image: MemoryMap;
};

export type Dm32RestoreLiveAddressMap = {
  addressBase?: number;
  dm32ContactsBase?: number;
  dm32ContactsEnd?: number;
};

export type Dm32RestoreBlock = {
  address: number;
  data: Uint8Array;
};

function canReadArchive(image: MemoryMap, offset: number, length: number): boolean {
  return offset >= 0 && length > 0 && offset + length <= image.size;
}

/** Same placement rule as memoryMapFromBackupRegions — packed vs absolute. */
function regionImageOffset(archive: Dm32RestoreArchive, region: RadioBackupRegionV1): number {
  const maxEnd = archive.manifest.regions.reduce(
    (max, r) => Math.max(max, r.address + r.byteLength),
    0,
  );
  const minAddr = archive.manifest.regions.reduce(
    (min, r) => Math.min(min, r.address),
    Number.POSITIVE_INFINITY,
  );
  const fitsAbsolute = maxEnd <= archive.image.size || minAddr === 0;
  if (fitsAbsolute) return region.address;
  return region.address - (Number.isFinite(minAddr) ? minAddr : 0);
}

function bytesForRegion(archive: Dm32RestoreArchive, region: RadioBackupRegionV1): Uint8Array {
  const offset = regionImageOffset(archive, region);
  if (!canReadArchive(archive.image, offset, region.byteLength)) {
    throw new RadioProtocolError(
      `DM-32 restore region ${region.id} [${region.address.toString(16)}, +${region.byteLength.toString(16)}) is outside the archive image`,
    );
  }
  return archive.image.get(offset, region.byteLength);
}

/**
 * Refuse when V-frame bases in the zip differ from this PROGRAM session.
 * Remapping after factory reset is out of scope.
 */
export function assertDm32RestoreAddressMap(
  manifest: RadioBackupManifestV1,
  live: Dm32RestoreLiveAddressMap,
): void {
  if (!manifest.restoreFragileAfterFactoryReset) return;
  const fields = ['addressBase', 'dm32ContactsBase', 'dm32ContactsEnd'] as const;
  for (const field of fields) {
    const expected = manifest[field];
    const actual = live[field];
    if (expected !== undefined && actual !== undefined && expected !== actual) {
      throw new RadioProtocolError(
        `Restore refused — live ${field} 0x${actual.toString(16)} does not match backup 0x${expected.toString(16)}. After a factory reset this archive cannot be restored.`,
      );
    }
  }
}

/** Window covering the archive's config base through its last packed block. */
function archiveConfigWindow(archive: Dm32RestoreArchive): Dm32ConfigWindow {
  const start = archive.manifest.addressBase ?? 0;
  let end = start;
  for (const region of archive.manifest.regions) {
    if (region.address === DM32_FACTORY_SECTOR_ADDRESS) continue;
    if (region.byteLength < DM32_BLOCK_SIZE) continue;
    const lastBlock = region.address + region.byteLength - DM32_BLOCK_SIZE;
    if (lastBlock > end) end = lastBlock;
  }
  return { start, end };
}

/** Lowest in-range tag-`0x02` address in the archive, when one is packed. */
export function dm32ArchiveLiveCalibrationAddress(archive: Dm32RestoreArchive): number | undefined {
  const window = archiveConfigWindow(archive);
  const candidates: { address: number; metadata: number }[] = [];
  for (const region of archive.manifest.regions) {
    if (region.address === DM32_FACTORY_SECTOR_ADDRESS) continue;
    if (region.byteLength < DM32_BLOCK_SIZE) continue;
    let data: Uint8Array;
    try {
      data = bytesForRegion(archive, region);
    } catch {
      continue;
    }
    if (data.byteLength < DM32_BLOCK_SIZE) continue;
    candidates.push({ address: region.address, metadata: data[DM32_METADATA_OFFSET] ?? 0 });
  }
  return selectDm32CalibrationPages(candidates, window).live?.address;
}

/**
 * Selected restorable 4KB blocks. Inspect-only regions are omitted even if
 * listed in regionIds. A restorable chunk that ends in `0x02`, or that targets
 * the live calibration address, throws before any write.
 */
export function listDm32RestoreBlocks(
  archive: Dm32RestoreArchive,
  regionIds: readonly string[],
): Dm32RestoreBlock[] {
  const selected = new Set(regionIds);
  const window = archiveConfigWindow(archive);
  const liveCalibrationAddress = dm32ArchiveLiveCalibrationAddress(archive);
  const blocks: Dm32RestoreBlock[] = [];
  for (const region of archive.manifest.regions) {
    if (!selected.has(region.id)) continue;
    if (region.restoreRole !== 'restorable') continue;
    const data = bytesForRegion(archive, region);
    for (let off = 0; off + DM32_BLOCK_SIZE <= data.byteLength; off += DM32_BLOCK_SIZE) {
      const chunk = data.subarray(off, off + DM32_BLOCK_SIZE);
      const address = region.address + off;
      const tag = chunk[DM32_METADATA_OFFSET] ?? 0;
      if (
        tag === DM32_METADATA.CALIBRATION ||
        (liveCalibrationAddress !== undefined && address === liveCalibrationAddress)
      ) {
        throw new RadioProtocolError(
          `Restore refused — block 0x${address.toString(16)} is calibration and is not written.`,
        );
      }
      if (isDm32RestoreNeverWriteBlock(chunk, address, window)) continue;
      blocks.push({ address, data: chunk.slice() });
    }
  }
  if (blocks.length === 0) {
    throw new RadioProtocolError('DM-32 restore has no restorable blocks to write');
  }
  return blocks;
}

/**
 * Refuse a backup that would upload two blocks with the same occupied metadata
 * tag. Free-page markers may repeat. Does not drop or rewrite the higher block.
 */
export function assertDm32RestoreUniqueOccupiedTags(blocks: readonly Dm32RestoreBlock[]): void {
  const seen = new Map<number, number>();
  for (const block of blocks) {
    const tag = block.data[DM32_METADATA_OFFSET] ?? 0;
    if (tag === DM32_METADATA.EMPTY || tag === DM32_METADATA.EMPTY_ALT) continue;
    const prior = seen.get(tag);
    if (prior !== undefined) {
      throw new RadioProtocolError(
        `Restore refused — two backup pages share metadata tag 0x${tag.toString(16)} (0x${prior.toString(16)} and 0x${block.address.toString(16)}). Restoring them would let the radio erase the higher page at boot.`,
      );
    }
    seen.set(tag, block.address);
  }
}
