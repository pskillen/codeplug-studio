/**
 * UV-17Pro restoreFromBackup — rebuild the packed programming clone from
 * restorable MEM bins and upload those spans. Does not assemble, merge
 * channels into hydration, or seed from a project bag.
 */

import type { RadioBackupManifestV1, RadioBackupRegionV1 } from '../../backup/types.ts';
import type { MemoryMap } from '../../types.ts';
import { RadioProtocolError } from '../../kit/errors.ts';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import { uv17ProBackupMemSpans, type Uv17ProBackupMemSpan } from './backupRestoreRoles.ts';
import type { Uv17ProLayout } from './layout.ts';

export type Uv17ProRestoreArchive = {
  manifest: RadioBackupManifestV1;
  image: MemoryMap;
};

function bytesForSpan(
  image: MemoryMap,
  region: RadioBackupRegionV1,
  span: Uv17ProBackupMemSpan,
): Uint8Array {
  if (region.byteLength !== span.size) {
    throw new RadioProtocolError(
      `UV-17Pro restore region ${region.id} length 0x${region.byteLength.toString(16)} does not match MEM span 0x${span.size.toString(16)}`,
    );
  }
  if (region.address < 0 || region.address + span.size > image.size) {
    throw new RadioProtocolError(
      `UV-17Pro restore region ${region.id} [${region.address.toString(16)}, +${span.size.toString(16)}) is outside the archive image`,
    );
  }
  return image.get(region.address, span.size);
}

/**
 * Packed programming clone: selected restorable MEM bins copied onto 0xff.
 * Unselected / inspect-only spans stay 0xff and are not programmed.
 */
export function intendedUv17ProRestoreImage(
  layout: Uv17ProLayout,
  archive: Uv17ProRestoreArchive,
  regionIds: readonly string[],
): MemoryMap {
  const intended = createMemoryMap(layout.memTotal);
  intended.fill(0, layout.memTotal, 0xff);
  const selected = new Set(regionIds);
  let copied = 0;
  for (const span of uv17ProBackupMemSpans(layout)) {
    if (!selected.has(span.id)) continue;
    const region = archive.manifest.regions.find((r) => r.id === span.id);
    if (!region || region.restoreRole !== 'restorable') continue;
    const data = bytesForSpan(archive.image, region, span);
    intended.set(span.packedOffset, data);
    copied += 1;
  }
  if (copied === 0) {
    throw new RadioProtocolError('UV-17Pro restore has no restorable MEM spans to write');
  }
  return intended;
}

/** Radio addresses in selected restorable MEM spans (upload write list). */
export function listUv17ProRestoreWriteAddresses(
  layout: Uv17ProLayout,
  archive: Uv17ProRestoreArchive,
  regionIds: readonly string[],
): number[] {
  const selected = new Set(regionIds);
  const addrs: number[] = [];
  for (const span of uv17ProBackupMemSpans(layout)) {
    if (!selected.has(span.id)) continue;
    const region = archive.manifest.regions.find((r) => r.id === span.id);
    if (!region || region.restoreRole !== 'restorable') continue;
    for (let off = 0; off < span.size; off += layout.blockSize) {
      addrs.push(span.radioAddr + off);
    }
  }
  if (addrs.length === 0) {
    throw new RadioProtocolError('UV-17Pro restore has no restorable MEM spans to write');
  }
  return addrs;
}
