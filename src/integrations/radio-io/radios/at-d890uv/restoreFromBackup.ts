/**
 * AT-D890UV restoreFromBackup — overlay archive restorable regions onto a
 * fresh live erase-unit read. Does not assemble, encode-from-build, or use
 * Write-codeplug cache overlay (`applyAtD890WriteImageToCache` / listWriteChunks).
 */

import type { BytePipe, MemoryMap, ProgressFn } from '../../types.ts';
import type { RadioBackupManifestV1, RadioBackupRegionV1 } from '../../backup/types.ts';
import { RadioProtocolError } from '../../kit/errors.ts';
import { reportProgress, throwIfAborted } from '../../kit/progress.ts';
import { atD890ReadMemory, atD890WriteMemory } from './connection.ts';
import { AT_D890_BLOCK_SIZE, AT_D890_SAFE_SKIP_WRITE_ADDR, D890_MAP } from './constants.ts';
import {
  isAtD890ChannelDataAddress,
  isAtD890ChannelDataRealAddress,
} from './channelDataGeometry.ts';
import {
  eraseUnitBaseFor,
  isAtD890EraseUnitBookkeepingAddress,
  listTouchedEraseUnits,
  readSpanForEraseUnit,
} from './eraseUnits.ts';
import { assertAtD890LocalInfoPlausible } from './identityCheck.ts';
import {
  assertPreservedBytesMatchFreshRead,
  listSparseStagingChunks,
  modelledAddressSetFromChunks,
  overlayModelledChunksOntoUnit,
  type AtD890StagingChunk,
} from './sparseEraseRmw.ts';
import { assertAtD890TransmitAddress } from './writableExtents.ts';
import { isAtD890RestoreNeverWriteAddress } from './backupRestoreRoles.ts';

export type AtD890RestoreArchive = {
  manifest: RadioBackupManifestV1;
  image: MemoryMap;
};

function canReadArchive(image: MemoryMap, address: number, length: number): boolean {
  return address >= 0 && length > 0 && address + length <= image.size;
}

function shouldOverlayArchiveAddress(address: number): boolean {
  if (address === AT_D890_SAFE_SKIP_WRITE_ADDR) return false;
  if (isAtD890EraseUnitBookkeepingAddress(address)) return false;
  if (isAtD890ChannelDataAddress(address) && !isAtD890ChannelDataRealAddress(address)) {
    return false;
  }
  return !isAtD890RestoreNeverWriteAddress(address);
}

function chunksFromArchiveRegion(
  image: MemoryMap,
  region: RadioBackupRegionV1,
): AtD890StagingChunk[] {
  if (region.restoreRole !== 'restorable') return [];
  if (!canReadArchive(image, region.address, region.byteLength)) {
    throw new RadioProtocolError(
      `D890 restore region ${region.id} [${region.address.toString(16)}, +${region.byteLength.toString(16)}) is outside the archive image`,
    );
  }
  const chunks: AtD890StagingChunk[] = [];
  const start = Math.floor(region.address / AT_D890_BLOCK_SIZE) * AT_D890_BLOCK_SIZE;
  const end = region.address + region.byteLength;
  for (let addr = start; addr < end; addr += AT_D890_BLOCK_SIZE) {
    if (!shouldOverlayArchiveAddress(addr)) continue;
    if (!canReadArchive(image, addr, AT_D890_BLOCK_SIZE)) continue;
    chunks.push({ address: addr, data: image.get(addr, AT_D890_BLOCK_SIZE) });
  }
  return chunks;
}

export function listAtD890RestoreModelledChunks(
  archive: AtD890RestoreArchive,
  regionIds: readonly string[],
): AtD890StagingChunk[] {
  const selected = new Set(regionIds);
  const chunks: AtD890StagingChunk[] = [];
  for (const region of archive.manifest.regions) {
    if (!selected.has(region.id)) continue;
    chunks.push(...chunksFromArchiveRegion(archive.image, region));
  }
  chunks.sort((a, b) => a.address - b.address);
  return chunks;
}

/**
 * Replay restorable archive bytes with the same erase-unit RMW as Write,
 * onto this session's live units — never a blank map, never LocalInfo/cals.
 */
export async function restoreAtD890FromBackup(
  pipe: BytePipe,
  archive: AtD890RestoreArchive,
  opts: {
    regionIds: readonly string[];
    onProgress?: ProgressFn;
    signal?: AbortSignal;
    readBlockSize?: number;
  },
): Promise<void> {
  const modelledChunks = listAtD890RestoreModelledChunks(archive, opts.regionIds);
  if (modelledChunks.length === 0) {
    throw new RadioProtocolError('D890 restore has no restorable archive chunks to write');
  }

  const modelledAddresses = modelledAddressSetFromChunks(modelledChunks);
  const touchedUnits = listTouchedEraseUnits(modelledChunks.map((c) => c.address));
  const touchedUnitSet = new Set(touchedUnits);
  const readBlockSize = opts.readBlockSize ?? AT_D890_BLOCK_SIZE;

  const liveLocal = await atD890ReadMemory(
    pipe,
    D890_MAP.LocalInfo,
    D890_MAP.LocalInfoLength,
    opts.signal,
    readBlockSize,
  );
  assertAtD890LocalInfoPlausible(liveLocal);

  const freshUnits = new Map<number, Uint8Array>();
  for (let u = 0; u < touchedUnits.length; u++) {
    throwIfAborted(opts.signal);
    const unitBase = touchedUnits[u]!;
    const { start, length } = readSpanForEraseUnit(unitBase);
    reportProgress(
      opts.onProgress,
      {
        cur: u,
        max: touchedUnits.length,
        msg: `Reading erase unit 0x${unitBase.toString(16)}…`,
        stage: 'Preserving live flash',
      },
      opts.signal,
    );
    const data = await atD890ReadMemory(pipe, start, length, opts.signal, readBlockSize);
    freshUnits.set(unitBase, data);
  }

  const mergedUnits = new Map<number, Uint8Array>();
  for (const [base, data] of freshUnits) {
    mergedUnits.set(base, data.slice());
  }
  for (const unitBase of touchedUnits) {
    const unitChunks = modelledChunks.filter((c) => eraseUnitBaseFor(c.address) === unitBase);
    overlayModelledChunksOntoUnit(unitBase, mergedUnits.get(unitBase)!, unitChunks);
  }

  const stagingChunks = listSparseStagingChunks(mergedUnits, modelledAddresses);
  assertPreservedBytesMatchFreshRead(stagingChunks, freshUnits, modelledAddresses);

  // Never LocalInfo, skip-addr, or flash bookkeeping. Live alarm in a touched
  // unit is retransmitted from the fresh read (not the archive) so erase RMW
  // does not blank it.
  const transmittedChunks = stagingChunks.filter((c) => {
    if (c.address === AT_D890_SAFE_SKIP_WRITE_ADDR) return false;
    if (isAtD890EraseUnitBookkeepingAddress(c.address)) return false;
    if (
      c.address >= D890_MAP.LocalInfo &&
      c.address < D890_MAP.LocalInfo + D890_MAP.LocalInfoLength
    ) {
      return false;
    }
    return true;
  });

  const transmitGuard = (address: number) => {
    if (address >= D890_MAP.LocalInfo && address < D890_MAP.LocalInfo + D890_MAP.LocalInfoLength) {
      throw new RadioProtocolError(
        `D890 restore refused LocalInfo write at 0x${address.toString(16)}`,
      );
    }
    if (address === AT_D890_SAFE_SKIP_WRITE_ADDR) {
      throw new RadioProtocolError(
        `D890 restore refused at forbidden address 0x${address.toString(16)} (family safe-skip)`,
      );
    }
    assertAtD890TransmitAddress(address, touchedUnitSet);
  };

  reportProgress(
    opts.onProgress,
    {
      cur: 0,
      max: transmittedChunks.length || 1,
      msg: 'Restoring backup regions…',
      stage: 'Restore',
    },
    opts.signal,
  );

  for (let i = 0; i < transmittedChunks.length; i++) {
    throwIfAborted(opts.signal);
    const { address, data } = transmittedChunks[i]!;
    reportProgress(
      opts.onProgress,
      {
        cur: i + 1,
        max: transmittedChunks.length,
        msg: `Restoring 0x${address.toString(16)}`,
        stage: 'Restore',
      },
      opts.signal,
    );
    await atD890WriteMemory(pipe, address, data, opts.signal, { transmitGuard });
  }
}
