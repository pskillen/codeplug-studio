/**
 * UV-5R Mini MM9PDY: the zone table (MMZ1, external SPI 0xC000-0xCFFF) as a fourth Backup region, and the frames a
 * Restore of it writes. MM9PDY profile only; the stock profile never reads or writes the range.
 */

import type { RadioBackupManifestV1, RadioBackupRegionV1 } from '../../backup/types.ts';
import { RadioProtocolError } from '../../kit/errors.ts';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import type { MemoryMap } from '../../types.ts';
import {
  decodeUv5rMiniZoneTable,
  MMZ1_BASE,
  MMZ1_FRAME_BYTES,
  MMZ1_HEADER_ADDR,
  MMZ1_SECTOR_BYTES,
  type Uv5rMiniZoneFrame,
} from './modData/index.ts';

/** Backup region id of the zone table. */
export const UV5R_MINI_ZONES_REGION_ID = 'zones';

/** The Web Serial profile whose Backup and Restore carry the zone table. */
export const UV5R_MINI_MM9PDY_PROFILE_ID = 'radio-io-uv5r-mini-mm9pdy';

export type Uv5rMiniBackupRestoreProfile = 'stock' | 'mm9pdy';

export function uv5rMiniBackupRestoreProfile(
  profileId: string | undefined,
): Uv5rMiniBackupRestoreProfile {
  return profileId === UV5R_MINI_MM9PDY_PROFILE_ID ? 'mm9pdy' : 'stock';
}

/** The 64 frame addresses of the table sector, in order (0xC000-0xCFC0). */
export function uv5rMiniZoneTableFrameAddresses(): number[] {
  const out: number[] = [];
  for (let off = 0; off < MMZ1_SECTOR_BYTES; off += MMZ1_FRAME_BYTES) out.push(MMZ1_BASE + off);
  return out;
}

/** "3 zones", "1 zone" or "no table" (any sector the radio's reader rejects). */
export function summariseUv5rMiniZoneSector(sector: Uint8Array): string {
  const decoded = decodeUv5rMiniZoneTable(sector);
  if ('reject' in decoded) return 'no table';
  const n = decoded.zones.length;
  return `${n} zone${n === 1 ? '' : 's'}`;
}

/** The backup region for a sector read from the radio. Its address is the radio address, 0xC000. */
export function uv5rMiniZoneBackupRegion(sector: Uint8Array): {
  region: RadioBackupRegionV1;
  bytes: Uint8Array;
} {
  if (sector.length !== MMZ1_SECTOR_BYTES) {
    throw new RadioProtocolError(
      `UV-5R Mini zone table backup must be ${MMZ1_SECTOR_BYTES} bytes, got ${sector.length}`,
    );
  }
  return {
    region: {
      id: UV5R_MINI_ZONES_REGION_ID,
      label: `Zone table, MM9PDY (${summariseUv5rMiniZoneSector(sector)})`,
      address: MMZ1_BASE,
      byteLength: MMZ1_SECTOR_BYTES,
      path: `regions/${UV5R_MINI_ZONES_REGION_ID}.bin`,
      restoreRole: 'restorable',
    },
    bytes: sector.slice(),
  };
}

/**
 * The archive image a live MM9PDY Backup holds in memory: the packed clone at 0, the table at 0xC000, `FF`
 * between. Opening the zip rebuilds the same layout (`memoryMapFromBackupRegions`).
 */
export function uv5rMiniArchiveImageWithZoneTable(clone: MemoryMap, sector: Uint8Array): MemoryMap {
  const size = Math.max(clone.size, MMZ1_BASE + MMZ1_SECTOR_BYTES);
  const image = createMemoryMap(size);
  image.fill(0, size, 0xff);
  image.set(0, clone.get(0, clone.size));
  image.set(MMZ1_BASE, sector);
  return image;
}

/**
 * The frames a Restore of the table writes: the header at 0xC000 first, always (that write erases the sector), then
 * every later frame that is not all `FF`, in address order. A blank table restores as the header alone, so the radio
 * ends with no table. The bytes are the backup's, as read; the frames never leave 0xC000-0xCFC0.
 */
export function uv5rMiniZoneRestoreFrames(
  manifest: RadioBackupManifestV1,
  image: MemoryMap,
): Uv5rMiniZoneFrame[] {
  const region = manifest.regions.find((r) => r.id === UV5R_MINI_ZONES_REGION_ID);
  if (!region || region.restoreRole !== 'restorable') {
    throw new RadioProtocolError('UV-5R Mini restore: the backup holds no restorable zone table');
  }
  if (region.address !== MMZ1_BASE || region.byteLength !== MMZ1_SECTOR_BYTES) {
    throw new RadioProtocolError(
      `UV-5R Mini restore: the zone table region must be 0x${MMZ1_SECTOR_BYTES.toString(16)} bytes at 0x${MMZ1_BASE.toString(16)}`,
    );
  }
  if (image.size < MMZ1_BASE + MMZ1_SECTOR_BYTES) {
    throw new RadioProtocolError('UV-5R Mini restore: the archive image has no zone table bytes');
  }
  const sector = image.get(MMZ1_BASE, MMZ1_SECTOR_BYTES);
  const frames: Uv5rMiniZoneFrame[] = [];
  for (const address of uv5rMiniZoneTableFrameAddresses()) {
    const off = address - MMZ1_BASE;
    const bytes = sector.slice(off, off + MMZ1_FRAME_BYTES);
    if (address === MMZ1_HEADER_ADDR || bytes.some((b) => b !== 0xff)) {
      frames.push({ address, bytes });
    }
  }
  return frames;
}
