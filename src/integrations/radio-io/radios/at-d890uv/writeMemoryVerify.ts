/**
 * Cross-session write verify — compare staged upload bytes against a full memory dump.
 *
 * Staging chunks (what was actually transmitted) are the compare authority, not the
 * projected image. Sentinel regions are diffed separately (never-write preservation).
 */

import { AT_D890_MEMORY_REGIONS } from './memoryRegionExport.ts';
import type { AtD890StagingChunk } from './sparseEraseRmw.ts';
import {
  compareAtD890SentinelSnapshots,
  type AtD890SentinelCompareResult,
  type AtD890SentinelSnapshot,
} from './sentinelVerify.ts';
import { AT_D890_SENTINEL_EXTENTS } from './writableExtents.ts';

export interface AtD890WriteStagingSnapshot {
  readonly chunks: readonly AtD890StagingChunk[];
  readonly capturedAt: string;
}

export type AtD890RegionVerifyStatus = 'match' | 'mismatch' | 'not_written' | 'skipped';

export interface AtD890RegionVerifyRow {
  readonly id: string;
  readonly label: string;
  readonly group: string;
  readonly bytesRead: number;
  readonly stagedChunkCount: number;
  readonly mismatchedChunks: number;
  readonly status: AtD890RegionVerifyStatus;
}

export interface AtD890StagingChunkMismatch {
  readonly address: number;
  readonly regionId: string;
  readonly regionLabel: string;
  readonly expected: Uint8Array;
  readonly actual: Uint8Array;
}

export interface AtD890WriteVerifyResult {
  readonly ok: boolean;
  readonly model: string;
  readonly elapsedMs: number;
  readonly totalBytesRead: number;
  readonly staging: {
    readonly totalChunks: number;
    readonly mismatchedChunks: number;
    readonly mismatches: readonly AtD890StagingChunkMismatch[];
  };
  readonly sentinel: AtD890SentinelCompareResult;
  readonly regions: readonly AtD890RegionVerifyRow[];
}

function hexAddr(address: number): string {
  return `0x${address.toString(16)}`;
}

function bytesToHex(data: Uint8Array): string {
  return [...data].map((b) => b.toString(16).padStart(2, '0')).join(' ');
}

export function cloneAtD890WriteStagingSnapshot(
  snapshot: AtD890WriteStagingSnapshot,
): AtD890WriteStagingSnapshot {
  return {
    capturedAt: snapshot.capturedAt,
    chunks: snapshot.chunks.map((c) => ({ address: c.address, data: c.data.slice() })),
  };
}

export function captureAtD890WriteStagingSnapshot(
  chunks: readonly AtD890StagingChunk[],
): AtD890WriteStagingSnapshot {
  return {
    capturedAt: new Date().toISOString(),
    chunks: chunks.map((c) => ({ address: c.address, data: c.data.slice() })),
  };
}

/** Map region id → flat bytes from a memory dump. */
export function regionFilesFromDump(
  files: ReadonlyMap<string, Uint8Array>,
): ReadonlyMap<string, Uint8Array> {
  return files;
}

interface AddressLookup {
  readonly getByte: (address: number) => number | undefined;
  readonly regionAt: (address: number) => { id: string; label: string } | undefined;
}

function buildAddressLookup(files: ReadonlyMap<string, Uint8Array>): AddressLookup {
  const regionById = new Map(AT_D890_MEMORY_REGIONS.map((r) => [r.id, r]));

  function getByte(address: number): number | undefined {
    for (const regionDef of AT_D890_MEMORY_REGIONS) {
      const file = files.get(regionDef.id);
      if (!file) continue;
      let fileOff = 0;
      for (const chunk of regionDef.chunks) {
        const chunkEnd = chunk.address + chunk.length;
        if (address >= chunk.address && address < chunkEnd) {
          const off = address - chunk.address;
          return file[fileOff + off];
        }
        fileOff += chunk.length;
      }
    }
    return undefined;
  }

  function regionAt(address: number): { id: string; label: string } | undefined {
    for (const regionDef of AT_D890_MEMORY_REGIONS) {
      for (const chunk of regionDef.chunks) {
        const chunkEnd = chunk.address + chunk.length;
        if (address >= chunk.address && address < chunkEnd) {
          return { id: regionDef.id, label: regionDef.label };
        }
      }
    }
    return undefined;
  }

  void regionById;
  return { getByte, regionAt };
}

function readBytesAt(lookup: AddressLookup, address: number, length: number): Uint8Array | null {
  const out = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    const b = lookup.getByte(address + i);
    if (b === undefined) return null;
    out[i] = b;
  }
  return out;
}

function chunksEqual(expected: Uint8Array, actual: Uint8Array): boolean {
  if (expected.length !== actual.length) return false;
  for (let i = 0; i < expected.length; i++) {
    if (expected[i] !== actual[i]) return false;
  }
  return true;
}

/** Extract sentinel spans from a region dump for cross-session compare. */
export function sentinelSnapshotFromRegionDump(
  files: ReadonlyMap<string, Uint8Array>,
): AtD890SentinelSnapshot {
  const lookup = buildAddressLookup(files);
  const snap = new Map<string, Uint8Array>();
  for (const extent of AT_D890_SENTINEL_EXTENTS) {
    const data = readBytesAt(lookup, extent.start, extent.length);
    if (data) snap.set(extent.id, data);
  }
  return snap;
}

export function compareStagingAgainstRegionDump(
  snapshot: AtD890WriteStagingSnapshot,
  files: ReadonlyMap<string, Uint8Array>,
): { mismatches: AtD890StagingChunkMismatch[] } {
  const lookup = buildAddressLookup(files);
  const mismatches: AtD890StagingChunkMismatch[] = [];

  for (const { address, data } of snapshot.chunks) {
    const actual = readBytesAt(lookup, address, data.length);
    if (!actual || !chunksEqual(data, actual)) {
      const region = lookup.regionAt(address);
      mismatches.push({
        address,
        regionId: region?.id ?? 'unknown',
        regionLabel: region?.label ?? 'Unknown region',
        expected: data.slice(),
        actual: actual ?? new Uint8Array(data.length).fill(0xff),
      });
    }
  }

  return { mismatches };
}

export function summarizeVerifyByRegion(
  snapshot: AtD890WriteStagingSnapshot,
  files: ReadonlyMap<string, Uint8Array>,
  mismatches: readonly AtD890StagingChunkMismatch[],
): AtD890RegionVerifyRow[] {
  const mismatchCountByRegion = new Map<string, number>();
  const stagedCountByRegion = new Map<string, number>();

  for (const { address } of snapshot.chunks) {
    for (const regionDef of AT_D890_MEMORY_REGIONS) {
      for (const chunk of regionDef.chunks) {
        const chunkEnd = chunk.address + chunk.length;
        if (address >= chunk.address && address < chunkEnd) {
          stagedCountByRegion.set(regionDef.id, (stagedCountByRegion.get(regionDef.id) ?? 0) + 1);
          break;
        }
      }
    }
  }

  for (const m of mismatches) {
    mismatchCountByRegion.set(m.regionId, (mismatchCountByRegion.get(m.regionId) ?? 0) + 1);
  }

  return AT_D890_MEMORY_REGIONS.map((regionDef) => {
    const bytesRead = files.get(regionDef.id)?.length ?? 0;
    const stagedChunkCount = stagedCountByRegion.get(regionDef.id) ?? 0;
    const mismatchedChunks = mismatchCountByRegion.get(regionDef.id) ?? 0;
    let status: AtD890RegionVerifyStatus;
    if (bytesRead === 0) {
      status = 'skipped';
    } else if (stagedChunkCount === 0) {
      status = 'not_written';
    } else if (mismatchedChunks > 0) {
      status = 'mismatch';
    } else {
      status = 'match';
    }
    return {
      id: regionDef.id,
      label: regionDef.label,
      group: regionDef.group,
      bytesRead,
      stagedChunkCount,
      mismatchedChunks,
      status,
    };
  });
}

export function buildAtD890WriteVerifyResult(
  snapshot: AtD890WriteStagingSnapshot,
  files: ReadonlyMap<string, Uint8Array>,
  sentinelBefore: AtD890SentinelSnapshot | undefined,
  meta: { model: string; elapsedMs: number; totalBytesRead: number },
): AtD890WriteVerifyResult {
  const { mismatches } = compareStagingAgainstRegionDump(snapshot, files);
  const sentinelAfter = sentinelSnapshotFromRegionDump(files);
  const sentinel = sentinelBefore
    ? compareAtD890SentinelSnapshots(sentinelBefore, sentinelAfter)
    : ({ ok: true } as AtD890SentinelCompareResult);
  const regions = summarizeVerifyByRegion(snapshot, files, mismatches);
  const stagingOk = mismatches.length === 0;
  const sentinelOk = sentinel.ok;
  return {
    ok: stagingOk && sentinelOk,
    model: meta.model,
    elapsedMs: meta.elapsedMs,
    totalBytesRead: meta.totalBytesRead,
    staging: {
      totalChunks: snapshot.chunks.length,
      mismatchedChunks: mismatches.length,
      mismatches,
    },
    sentinel,
    regions,
  };
}

/** Copy-paste block for tier-3 docs or a GitHub issue comment. */
export function formatAtD890WriteVerifyMarkdown(
  result: AtD890WriteVerifyResult,
  meta: { measuredAt: string; readBlockSize?: number },
): string {
  const lines = [
    '### AT-D890UV write verify',
    '',
    `Measured: ${meta.measuredAt} · radio: ${result.model}${meta.readBlockSize != null ? ` · read block: ${meta.readBlockSize} bytes` : ''}`,
    `Read: ${result.totalBytesRead} bytes in ${(result.elapsedMs / 1000).toFixed(1)}s`,
    '',
    `**Overall:** ${result.ok ? 'PASS' : 'FAIL'} — ${result.staging.mismatchedChunks} of ${result.staging.totalChunks} staged chunks mismatched`,
    `**Preserved settings:** ${result.sentinel.ok ? 'PASS' : 'FAIL'}`,
    '',
    '| Region | Group | Staged chunks | Mismatches | Status |',
    '| --- | --- | --- | --- | --- |',
    ...result.regions
      .filter((r) => r.status !== 'skipped')
      .map(
        (r) =>
          `| ${r.label} | ${r.group} | ${r.stagedChunkCount} | ${r.mismatchedChunks} | ${r.status} |`,
      ),
  ];

  if (!result.sentinel.ok) {
    lines.push('', '**Preserved-settings mismatches:**');
    for (const m of result.sentinel.mismatches) {
      lines.push(`- ${m.label} (${m.id})`);
    }
  }

  if (result.staging.mismatches.length > 0) {
    lines.push('', '**Staging mismatches (first 20):**', '');
    lines.push('| Address | Region | Expected | Actual |');
    lines.push('| --- | --- | --- | --- |');
    for (const m of result.staging.mismatches.slice(0, 20)) {
      lines.push(
        `| ${hexAddr(m.address)} | ${m.regionLabel} | \`${bytesToHex(m.expected)}\` | \`${bytesToHex(m.actual)}\` |`,
      );
    }
    if (result.staging.mismatches.length > 20) {
      lines.push('', `… and ${result.staging.mismatches.length - 20} more mismatches.`);
    }
  }

  return lines.join('\n');
}

export { labelForAtD890SentinelId } from './sentinelVerify.ts';
export { AT_D890_BLOCK_SIZE } from './constants.ts';
