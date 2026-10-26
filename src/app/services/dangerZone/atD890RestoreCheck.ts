/**
 * Danger zone, step 8: read back what Restore wrote and compare it with the backup zip. Read only; it sends no
 * `W` frame. It compares exactly the 16-byte blocks Restore writes (bookkeeping markers, the family skip address,
 * channel-data blocks Restore leaves alone and the never-write regions are excluded), so LocalInfo and calibration
 * never enter the comparison.
 */

import type { RadioBackupManifestV1 } from '@integrations/radio-io/backup/index.ts';
import { throwIfAborted } from '@integrations/radio-io/kit/progress.ts';
import { atD890ReadMemory } from '@integrations/radio-io/radios/at-d890uv/connection.ts';
import { AT_D890_BLOCK_SIZE } from '@integrations/radio-io/radios/at-d890uv/constants.ts';
import { shouldOverlayArchiveAddress } from '@integrations/radio-io/radios/at-d890uv/restoreFromBackup.ts';
import type { BytePipe, MemoryMap, ProgressFn } from '@integrations/radio-io/types.ts';

export interface RestoreCheckDifference {
  regionId: string;
  label: string;
  /** Number of 16-byte blocks that differ. */
  blocks: number;
}

export interface RestoreCheckResult {
  ok: boolean;
  differences: RestoreCheckDifference[];
  /** Restorable regions that were read back. */
  regionsChecked: number;
}

/** Largest read in one call (the read path splits it into frames). */
const SLICE = 0x1_0000;

export async function checkAtD890RestoredRegions(
  pipe: BytePipe,
  archive: { manifest: RadioBackupManifestV1; image: MemoryMap },
  opts: { readBlockSize?: number; onProgress?: ProgressFn; signal?: AbortSignal } = {},
): Promise<RestoreCheckResult> {
  const regions = archive.manifest.regions.filter((r) => r.restoreRole === 'restorable');
  const differences: RestoreCheckDifference[] = [];
  for (let i = 0; i < regions.length; i++) {
    const region = regions[i]!;
    throwIfAborted(opts.signal);
    opts.onProgress?.({
      cur: i,
      max: regions.length,
      msg: `Reading back ${region.label}…`,
      stage: 'Check',
    });
    // Read whole blocks only, the way Restore wrote them.
    const start = Math.floor(region.address / AT_D890_BLOCK_SIZE) * AT_D890_BLOCK_SIZE;
    const end = region.address + region.byteLength;
    let blocks = 0;
    for (let slice = start; slice < end;) {
      // Slices stop at 64 KiB boundaries, so no read crosses an erase unit.
      const sliceEnd = Math.min(
        Math.ceil(end / AT_D890_BLOCK_SIZE) * AT_D890_BLOCK_SIZE,
        (Math.floor(slice / SLICE) + 1) * SLICE,
      );
      const length = sliceEnd - slice;
      const live = await atD890ReadMemory(pipe, slice, length, opts.signal, opts.readBlockSize);
      for (let off = 0; off < length; off += AT_D890_BLOCK_SIZE) {
        const address = slice + off;
        if (!shouldOverlayArchiveAddress(address)) continue;
        if (address + AT_D890_BLOCK_SIZE > archive.image.size) continue;
        const expected = archive.image.get(address, AT_D890_BLOCK_SIZE);
        for (let b = 0; b < AT_D890_BLOCK_SIZE; b++) {
          if (live[off + b] !== expected[b]) {
            blocks += 1;
            break;
          }
        }
      }
      slice = sliceEnd;
    }
    if (blocks > 0) differences.push({ regionId: region.id, label: region.label, blocks });
  }
  return { ok: differences.length === 0, differences, regionsChecked: regions.length };
}
