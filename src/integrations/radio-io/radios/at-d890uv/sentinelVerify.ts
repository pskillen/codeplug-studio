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

export type AtD890SentinelMismatch = { readonly id: string; readonly label: string };

export type AtD890SentinelCompareResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly mismatches: readonly AtD890SentinelMismatch[] };

/** Operator-facing labels for never-write regions (cross-session verify). */
export const AT_D890_SENTINEL_LABELS: Readonly<Record<string, string>> = {
  LocalInfo: 'Radio identity',
  OptionalSettingsMain: 'Language and display settings',
  OptionalSettingsExt: 'Power-on password settings',
  OptionalSettingsAprs: 'Optional GPS info',
  AlarmBitmap: 'Alarm settings',
  AlarmData: 'Alarm data',
};

export function labelForAtD890SentinelId(id: string): string {
  return AT_D890_SENTINEL_LABELS[id] ?? id;
}

export function cloneAtD890SentinelSnapshot(
  snapshot: AtD890SentinelSnapshot,
): AtD890SentinelSnapshot {
  const out = new Map<string, Uint8Array>();
  for (const [id, data] of snapshot) {
    out.set(id, data.slice());
  }
  return out;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Cross-session diff of never-write regions captured before and after a committed Write.
 */
export function compareAtD890SentinelSnapshots(
  before: AtD890SentinelSnapshot,
  after: AtD890SentinelSnapshot,
): AtD890SentinelCompareResult {
  const mismatches: AtD890SentinelMismatch[] = [];
  for (const extent of AT_D890_SENTINEL_EXTENTS) {
    const prior = before.get(extent.id);
    const next = after.get(extent.id);
    if (!prior || !next || !bytesEqual(prior, next)) {
      mismatches.push({ id: extent.id, label: labelForAtD890SentinelId(extent.id) });
    }
  }
  if (mismatches.length === 0) return { ok: true };
  return { ok: false, mismatches };
}

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
