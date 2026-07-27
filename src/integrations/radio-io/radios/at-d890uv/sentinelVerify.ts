/**
 * Pre/post Write sentinel reads for never-write regions (WATCH-08).
 */

import type { BytePipe } from '../../types.ts';
import { RadioProtocolError } from '../../kit/errors.ts';
import { atD890ReadMemory } from './connection.ts';
import { AT_D890_SENTINEL_EXTENTS } from './writableExtents.ts';

export type AtD890SentinelSnapshot = ReadonlyMap<string, Uint8Array>;

export async function snapshotAtD890SentinelRegions(
  pipe: BytePipe,
  signal?: AbortSignal,
): Promise<AtD890SentinelSnapshot> {
  const snap = new Map<string, Uint8Array>();
  for (const extent of AT_D890_SENTINEL_EXTENTS) {
    const data = await atD890ReadMemory(pipe, extent.start, extent.length, signal);
    snap.set(extent.id, data);
  }
  return snap;
}

export function assertAtD890SentinelRegionsUnchanged(
  before: AtD890SentinelSnapshot,
  after: AtD890SentinelSnapshot,
): void {
  for (const extent of AT_D890_SENTINEL_EXTENTS) {
    const pre = before.get(extent.id);
    const post = after.get(extent.id);
    if (!pre || !post) {
      throw new RadioProtocolError(`D890 sentinel verify missing snapshot for ${extent.id}`);
    }
    if (pre.length !== post.length) {
      throw new RadioProtocolError(`D890 sentinel ${extent.id} length changed after Write`);
    }
    for (let i = 0; i < pre.length; i++) {
      if (pre[i] !== post[i]) {
        throw new RadioProtocolError(
          `D890 sentinel ${extent.id} changed at +0x${i.toString(16)} after Write — upload touched a forbidden region`,
        );
      }
    }
  }
}
