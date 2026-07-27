/**
 * Pre-Write sentinel reads for never-write regions (WATCH-08).
 *
 * In-session read-back after Write is invalid on this radio — writes stage to RAM and
 * commit at END; reads in the same PROGRAM session return flash, not the shadow.
 */

import type { BytePipe } from '../../types.ts';
import { RadioProtocolError } from '../../kit/errors.ts';
import { atD890ReadMemory } from './connection.ts';
import { AT_D890_SENTINEL_EXTENTS } from './writableExtents.ts';

export type AtD890SentinelSnapshot = ReadonlyMap<string, Uint8Array>;

export async function snapshotAtD890SentinelRegions(
  pipe: BytePipe,
  signal?: AbortSignal,
  readBlockSize?: number,
): Promise<AtD890SentinelSnapshot> {
  const snap = new Map<string, Uint8Array>();
  for (const extent of AT_D890_SENTINEL_EXTENTS) {
    const data = await atD890ReadMemory(pipe, extent.start, extent.length, signal, readBlockSize);
    snap.set(extent.id, data);
  }
  return snap;
}

function isAllFf(data: Uint8Array): boolean {
  for (let i = 0; i < data.length; i++) {
    if (data[i] !== 0xff) return false;
  }
  return data.length > 0;
}

/**
 * Refuse Write when a sentinel region reads entirely erased (all 0xff).
 * An already-bricked radio passes silent in-session compare (0xff == 0xff) — catch it here.
 */
export function assertAtD890SentinelRegionsPlausible(snapshot: AtD890SentinelSnapshot): void {
  for (const extent of AT_D890_SENTINEL_EXTENTS) {
    const data = snapshot.get(extent.id);
    if (!data) {
      throw new RadioProtocolError(`D890 sentinel verify missing snapshot for ${extent.id}`);
    }
    if (isAllFf(data)) {
      throw new RadioProtocolError(
        `D890 sentinel ${extent.id} reads erased (all 0xff) — radio may already be faulted; refuse Write`,
      );
    }
  }
}
