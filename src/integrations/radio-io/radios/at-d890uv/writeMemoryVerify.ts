/**
 * Cross-session write verify — compare staged upload bytes against a full memory dump.
 *
 * Staging chunks (what was actually transmitted) are the compare authority, not the
 * projected image. Sentinel regions are diffed separately (never-write preservation).
 */

import { AT_D890_MEMORY_REGIONS } from './memoryRegionExport.ts';
import type { AtD890StagingChunk } from './sparseEraseRmw.ts';
import { eraseUnitBaseFor, isAtD890ExcludedBookkeepingStagingAddress } from './eraseUnits.ts';
import {
  compareAtD890SentinelSnapshots,
  type AtD890SentinelCompareResult,
  type AtD890SentinelSnapshot,
} from './sentinelVerify.ts';
import { AT_D890_SENTINEL_EXTENTS } from './writableExtents.ts';
import { AT_D890_BLOCK_SIZE, D890_MAP } from './constants.ts';
import { getCacheBytes, type AtD890DownloadCache } from './memory.ts';
import {
  summarizeEraseUnitCommitVerdicts,
  type WriteVerifyEraseUnitRow,
} from '../../writeVerifyCompare.ts';
import type { WriteVerifyByteLookup } from '../../writeVerifyCompare.ts';

export const AT_D890_RMW_SPILL_REGION_ID = 'rmwPreservedSpill';
export const AT_D890_RMW_SPILL_REGION_LABEL = 'RMW-preserved spill (outside modelled banks)';
export const AT_D890_RMW_SPILL_GROUP = 'rmwPreserved';

export interface AtD890WriteStagingSnapshot {
  readonly chunks: readonly AtD890StagingChunk[];
  readonly capturedAt: string;
  /** Live radio bytes at each staged address (fresh erase-unit read before overlay). */
  readonly preWriteChunks: readonly AtD890StagingChunk[];
  /** Last-download cache bytes at staged addresses — staleness guard only. */
  readonly downloadCacheChunks?: readonly AtD890StagingChunk[];
}

export interface AtD890CacheStaleness {
  readonly differingChunks: number;
  readonly message: string;
}

export type AtD890RegionVerifyStatus =
  'match' | 'mismatch' | 'not_read' | 'not_written' | 'skipped';

export interface AtD890RegionVerifyRow {
  readonly id: string;
  readonly label: string;
  readonly group: string;
  readonly bytesRead: number;
  readonly stagedChunkCount: number;
  readonly mismatchedChunks: number;
  readonly notReadChunks: number;
  readonly status: AtD890RegionVerifyStatus;
}

export type AtD890StagingChunkMismatchKind = 'mismatch' | 'not_read';

export interface AtD890StagingChunkMismatch {
  readonly kind: AtD890StagingChunkMismatchKind;
  readonly address: number;
  readonly regionId: string;
  readonly regionLabel: string;
  readonly expected: Uint8Array;
  /** Absent when {@link kind} is `not_read` — never fabricate unread bytes. */
  readonly actual: Uint8Array | null;
}

export interface AtD890WriteVerifyResult {
  readonly ok: boolean;
  readonly model: string;
  readonly elapsedMs: number;
  readonly totalBytesRead: number;
  /** ISO timestamp from the pre-commit staging snapshot. */
  readonly stagingCapturedAt: string;
  readonly staging: {
    /** Staged chunks compared (excludes erase-unit bookkeeping blocks). */
    readonly totalChunks: number;
    /** Bookkeeping blocks staged but excluded from compare (per-unit +0x3fbf0 / +0x3fff0 outside modelled banks). */
    readonly excludedBookkeepingChunks: number;
    readonly mismatchedChunks: number;
    /** Staged chunks with no readback in the verify dump (compare could not run). */
    readonly notReadChunks: number;
    readonly mismatches: readonly AtD890StagingChunkMismatch[];
  };
  readonly sentinel: AtD890SentinelCompareResult;
  readonly regions: readonly AtD890RegionVerifyRow[];
  readonly eraseUnits: readonly WriteVerifyEraseUnitRow[];
  readonly cacheStaleness?: AtD890CacheStaleness;
}

/** Optional session context for agent-oriented debug export. */
export interface AtD890WriteVerifyDebugContext {
  readonly buildId: string;
  readonly egressId: string;
  readonly formatId: string;
  readonly profileId: string;
  readonly measuredAt: string;
  readonly buildVersion?: string;
  readonly buildEnv?: string;
  readonly pageUrl?: string;
  readonly userAgent?: string;
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
    preWriteChunks: snapshot.preWriteChunks.map((c) => ({
      address: c.address,
      data: c.data.slice(),
    })),
    downloadCacheChunks: snapshot.downloadCacheChunks?.map((c) => ({
      address: c.address,
      data: c.data.slice(),
    })),
  };
}

export function captureAtD890WriteStagingSnapshot(
  chunks: readonly AtD890StagingChunk[],
  opts?: {
    /** Live radio bytes at each staged address (pre-overlay fresh erase-unit read). */
    preWriteFromRadio?: readonly AtD890StagingChunk[];
    /** Last-download cache for staleness guard vs {@link preWriteFromRadio}. */
    downloadCache?: AtD890DownloadCache;
  },
): AtD890WriteStagingSnapshot {
  const preWriteFromRadio = opts?.preWriteFromRadio ?? [];
  const preWriteChunks =
    preWriteFromRadio.length > 0
      ? preWriteFromRadio.map((c) => ({ address: c.address, data: c.data.slice() }))
      : opts?.downloadCache
        ? chunks.map((c) => ({
            address: c.address,
            data: getCacheBytes(opts.downloadCache!, c.address, c.data.length).slice(),
          }))
        : [];

  const downloadCacheChunks = opts?.downloadCache
    ? chunks.map((c) => ({
        address: c.address,
        data: getCacheBytes(opts.downloadCache!, c.address, c.data.length).slice(),
      }))
    : undefined;

  return {
    capturedAt: new Date().toISOString(),
    chunks: chunks.map((c) => ({ address: c.address, data: c.data.slice() })),
    preWriteChunks,
    downloadCacheChunks,
  };
}

function chunksEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function summarizeDownloadCacheStaleness(
  preWriteRadio: readonly AtD890StagingChunk[],
  downloadCacheChunks: readonly AtD890StagingChunk[] | undefined,
): AtD890CacheStaleness | undefined {
  if (!downloadCacheChunks || downloadCacheChunks.length === 0) return undefined;
  const cacheByAddress = new Map(downloadCacheChunks.map((c) => [c.address, c.data]));
  let differingChunks = 0;
  for (const { address, data } of preWriteRadio) {
    const cached = cacheByAddress.get(address);
    if (cached !== undefined && !chunksEqual(data, cached)) differingChunks++;
  }
  if (differingChunks === 0) return undefined;
  return {
    differingChunks,
    message: `Radio differs from last Download at ${differingChunks} staged 16-byte blocks — another writer (e.g. CPS) may have modified flash since hydration.`,
  };
}

/** Zone A/B channel tables hold the operator's per-zone selection — volatile across write and verify. */
export function isAtD890VolatileVerifyAddress(address: number): boolean {
  const zoneBEnd = D890_MAP.ZoneBChannel + D890_MAP.ZoneTableBytes;
  return address >= D890_MAP.ZoneAChannel && address < zoneBEnd;
}

/** Whether `address` falls inside a documented modelled {@link AT_D890_MEMORY_REGIONS} span. */
export function atD890AddressInModelledRegions(address: number): boolean {
  for (const regionDef of AT_D890_MEMORY_REGIONS) {
    for (const chunk of regionDef.chunks) {
      const chunkEnd = chunk.address + chunk.length;
      if (address >= chunk.address && address < chunkEnd) return true;
    }
  }
  return false;
}

/**
 * Staged 16-byte block starts outside every modelled bank (RMW erase-unit spill).
 *
 * `ChannelData` writable extent is `0x40000` per block but verify reads only the
 * `0x4000` used prefix per block ({@link AT_D890_MEMORY_REGIONS}); the gap is covered
 * here via targeted spill reads, except for excluded bookkeeping tail blocks.
 */
export function listStagingAddressesOutsideModelledRegions(
  snapshot: AtD890WriteStagingSnapshot,
): number[] {
  const addresses = new Set<number>();
  for (const { address } of snapshot.chunks) {
    if (atD890AddressInModelledRegions(address)) continue;
    if (isAtD890ExcludedBookkeepingStagingAddress(address, true)) continue;
    addresses.add(address);
  }
  return [...addresses].sort((a, b) => a - b);
}

function countExcludedBookkeepingChunks(snapshot: AtD890WriteStagingSnapshot): number {
  return snapshot.chunks.filter((c) =>
    isAtD890ExcludedBookkeepingStagingAddress(
      c.address,
      !atD890AddressInModelledRegions(c.address),
    ),
  ).length;
}

function isComparableStagingAddress(address: number): boolean {
  if (isAtD890VolatileVerifyAddress(address)) return false;
  return !isAtD890ExcludedBookkeepingStagingAddress(
    address,
    !atD890AddressInModelledRegions(address),
  );
}

function countExcludedVolatileChunks(snapshot: AtD890WriteStagingSnapshot): number {
  return snapshot.chunks.filter((c) => isAtD890VolatileVerifyAddress(c.address)).length;
}

interface AddressLookup {
  readonly getByte: (address: number) => number | undefined;
  readonly regionAt: (address: number) => { id: string; label: string } | undefined;
}

function buildAddressLookup(
  files: ReadonlyMap<string, Uint8Array>,
  spillChunks: ReadonlyMap<number, Uint8Array> = new Map(),
): AddressLookup {
  function getByteFromSpill(address: number): number | undefined {
    for (const [chunkAddr, data] of spillChunks) {
      if (address >= chunkAddr && address < chunkAddr + data.length) {
        return data[address - chunkAddr];
      }
    }
    return undefined;
  }

  function getByte(address: number): number | undefined {
    const spillByte = getByteFromSpill(address);
    if (spillByte !== undefined) return spillByte;
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
    if (spillChunks.has(address)) {
      return { id: AT_D890_RMW_SPILL_REGION_ID, label: AT_D890_RMW_SPILL_REGION_LABEL };
    }
    return undefined;
  }

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
  spillChunks: ReadonlyMap<number, Uint8Array> = new Map(),
): { mismatches: AtD890StagingChunkMismatch[] } {
  const lookup = buildAddressLookup(files, spillChunks);
  const mismatches: AtD890StagingChunkMismatch[] = [];

  for (const { address, data } of snapshot.chunks) {
    if (!isComparableStagingAddress(address)) continue;
    const actual = readBytesAt(lookup, address, data.length);
    if (actual === null) {
      const region = lookup.regionAt(address);
      mismatches.push({
        kind: 'not_read',
        address,
        regionId: region?.id ?? 'unknown',
        regionLabel: region?.label ?? 'Unknown address (not read)',
        expected: data.slice(),
        actual: null,
      });
      continue;
    }
    if (!chunksEqual(data, actual)) {
      const region = lookup.regionAt(address);
      mismatches.push({
        kind: 'mismatch',
        address,
        regionId: region?.id ?? 'unknown',
        regionLabel: region?.label ?? 'Unknown address',
        expected: data.slice(),
        actual,
      });
    }
  }

  return { mismatches };
}

export function summarizeVerifyByRegion(
  snapshot: AtD890WriteStagingSnapshot,
  files: ReadonlyMap<string, Uint8Array>,
  mismatches: readonly AtD890StagingChunkMismatch[],
  spillChunks: ReadonlyMap<number, Uint8Array> = new Map(),
): AtD890RegionVerifyRow[] {
  const mismatchCountByRegion = new Map<string, number>();
  const notReadCountByRegion = new Map<string, number>();
  const stagedCountByRegion = new Map<string, number>();

  for (const { address } of snapshot.chunks) {
    if (!isComparableStagingAddress(address)) continue;
    let regionId: string | undefined;
    for (const regionDef of AT_D890_MEMORY_REGIONS) {
      for (const chunk of regionDef.chunks) {
        const chunkEnd = chunk.address + chunk.length;
        if (address >= chunk.address && address < chunkEnd) {
          regionId = regionDef.id;
          break;
        }
      }
      if (regionId) break;
    }
    if (!regionId) {
      regionId = spillChunks.has(address) ? AT_D890_RMW_SPILL_REGION_ID : 'unknown';
    }
    stagedCountByRegion.set(regionId, (stagedCountByRegion.get(regionId) ?? 0) + 1);
  }

  for (const m of mismatches) {
    if (m.kind === 'not_read') {
      notReadCountByRegion.set(m.regionId, (notReadCountByRegion.get(m.regionId) ?? 0) + 1);
    } else {
      mismatchCountByRegion.set(m.regionId, (mismatchCountByRegion.get(m.regionId) ?? 0) + 1);
    }
  }

  const rows = AT_D890_MEMORY_REGIONS.map((regionDef) => {
    const bytesRead = files.get(regionDef.id)?.length ?? 0;
    const stagedChunkCount = stagedCountByRegion.get(regionDef.id) ?? 0;
    const mismatchedChunks = mismatchCountByRegion.get(regionDef.id) ?? 0;
    const notReadChunks = notReadCountByRegion.get(regionDef.id) ?? 0;
    let status: AtD890RegionVerifyStatus;
    if (bytesRead === 0) {
      status = 'skipped';
    } else if (stagedChunkCount === 0) {
      status = 'not_written';
    } else if (mismatchedChunks > 0) {
      status = 'mismatch';
    } else if (notReadChunks > 0) {
      status = 'not_read';
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
      notReadChunks,
      status,
    };
  });

  const spillStaged = stagedCountByRegion.get(AT_D890_RMW_SPILL_REGION_ID) ?? 0;
  if (spillStaged > 0) {
    const mismatchedChunks = mismatchCountByRegion.get(AT_D890_RMW_SPILL_REGION_ID) ?? 0;
    const notReadChunks = notReadCountByRegion.get(AT_D890_RMW_SPILL_REGION_ID) ?? 0;
    let status: AtD890RegionVerifyStatus = 'match';
    if (mismatchedChunks > 0) status = 'mismatch';
    else if (notReadChunks > 0) status = 'not_read';
    rows.push({
      id: AT_D890_RMW_SPILL_REGION_ID,
      label: AT_D890_RMW_SPILL_REGION_LABEL,
      group: AT_D890_RMW_SPILL_GROUP,
      bytesRead: spillChunks.size * AT_D890_BLOCK_SIZE,
      stagedChunkCount: spillStaged,
      mismatchedChunks,
      notReadChunks,
      status,
    });
  }

  return rows;
}

function buildPostWriteLookup(
  files: ReadonlyMap<string, Uint8Array>,
  spillChunks: ReadonlyMap<number, Uint8Array>,
): WriteVerifyByteLookup {
  const addressLookup = buildAddressLookup(files, spillChunks);
  return {
    get(address: number, length: number): Uint8Array | null {
      return readBytesAt(addressLookup, address, length);
    },
  };
}

export function buildAtD890WriteVerifyResult(
  snapshot: AtD890WriteStagingSnapshot,
  files: ReadonlyMap<string, Uint8Array>,
  sentinelBefore: AtD890SentinelSnapshot | undefined,
  meta: { model: string; elapsedMs: number; totalBytesRead: number },
  spillChunks: ReadonlyMap<number, Uint8Array> = new Map(),
): AtD890WriteVerifyResult {
  const { mismatches } = compareStagingAgainstRegionDump(snapshot, files, spillChunks);
  const sentinelAfter = sentinelSnapshotFromRegionDump(files);
  const sentinel = sentinelBefore
    ? compareAtD890SentinelSnapshots(sentinelBefore, sentinelAfter)
    : ({ ok: true } as AtD890SentinelCompareResult);
  const regions = summarizeVerifyByRegion(snapshot, files, mismatches, spillChunks);
  const notReadChunks = mismatches.filter((m) => m.kind === 'not_read').length;
  const mismatchedChunks = mismatches.filter((m) => m.kind === 'mismatch').length;
  const stagingOk = mismatchedChunks === 0 && notReadChunks === 0;
  const sentinelOk = sentinel.ok;
  const excludedBookkeepingChunks = countExcludedBookkeepingChunks(snapshot);
  const excludedVolatileChunks = countExcludedVolatileChunks(snapshot);
  const comparableChunks =
    snapshot.chunks.length - excludedBookkeepingChunks - excludedVolatileChunks;
  const preWriteByAddress = new Map(snapshot.preWriteChunks.map((c) => [c.address, c.data]));
  const cacheStaleness = summarizeDownloadCacheStaleness(
    snapshot.preWriteChunks,
    snapshot.downloadCacheChunks,
  );
  const eraseUnits =
    snapshot.preWriteChunks.length > 0
      ? summarizeEraseUnitCommitVerdicts({
          stagingChunks: snapshot.chunks,
          preWriteByAddress,
          lookup: buildPostWriteLookup(files, spillChunks),
          unitBaseFor: eraseUnitBaseFor,
          isComparableAddress: isComparableStagingAddress,
        })
      : [];
  const eraseUnitsOk = eraseUnits.every(
    (u) => u.verdict === 'committed' || u.verdict === 'no-evidence',
  );
  return {
    ok: stagingOk && sentinelOk && eraseUnitsOk,
    model: meta.model,
    elapsedMs: meta.elapsedMs,
    totalBytesRead: meta.totalBytesRead,
    stagingCapturedAt: snapshot.capturedAt,
    staging: {
      totalChunks: comparableChunks,
      excludedBookkeepingChunks,
      mismatchedChunks,
      notReadChunks,
      mismatches,
    },
    sentinel,
    regions,
    eraseUnits,
    cacheStaleness,
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
    `**Overall:** ${result.ok ? 'PASS' : 'FAIL'} — ${result.staging.mismatchedChunks} of ${result.staging.totalChunks} staged chunks mismatched${result.staging.notReadChunks > 0 ? `, ${result.staging.notReadChunks} not read` : ''}${result.staging.excludedBookkeepingChunks > 0 ? ` (${result.staging.excludedBookkeepingChunks} erase-unit bookkeeping blocks excluded)` : ''}`,
    `**Preserved settings:** ${result.sentinel.ok ? 'PASS' : 'FAIL'}`,
    '',
  ];

  if (result.cacheStaleness) {
    lines.push(`**Cache staleness:** ${result.cacheStaleness.message}`, '');
  }

  if (result.eraseUnits.length > 0) {
    lines.push(
      '**Erase-unit commit:**',
      '',
      '| Unit base | Staged | Must change | Changed on flash | Verdict |',
      '| --- | --- | --- | --- | --- |',
      ...result.eraseUnits.map(
        (u) =>
          `| ${hexAddr(u.unitBase)} | ${u.stagedChunks} | ${u.mustChangeChunks} | ${u.changedChunks} | **${u.verdict}** |`,
      ),
      '',
    );
  }

  lines.push(
    '| Region | Group | Staged chunks | Mismatches | Status |',
    '| --- | --- | --- | --- | --- |',
    ...result.regions
      .filter((r) => r.status !== 'skipped')
      .map(
        (r) =>
          `| ${r.label} | ${r.group} | ${r.stagedChunkCount} | ${r.mismatchedChunks} | ${r.status} |`,
      ),
  );

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
      const actualCol = m.kind === 'not_read' ? '*(not read)*' : `\`${bytesToHex(m.actual!)}\``;
      lines.push(
        `| ${hexAddr(m.address)} | ${m.regionLabel} | \`${bytesToHex(m.expected)}\` | ${actualCol} |`,
      );
    }
    if (result.staging.mismatches.length > 20) {
      lines.push('', `… and ${result.staging.mismatches.length - 20} more mismatches.`);
    }
  }

  return lines.join('\n');
}

function groupMismatchesByRegion(
  mismatches: readonly AtD890StagingChunkMismatch[],
): Map<string, AtD890StagingChunkMismatch[]> {
  const grouped = new Map<string, AtD890StagingChunkMismatch[]>();
  for (const m of mismatches) {
    const list = grouped.get(m.regionId) ?? [];
    list.push(m);
    grouped.set(m.regionId, list);
  }
  return grouped;
}

/**
 * Agent-oriented debug report — full mismatch list, session context, and investigation hints.
 * Paste into an AI chat or GitHub issue when diagnosing missed block writes.
 */
export function formatAtD890WriteVerifyDebugMarkdown(
  result: AtD890WriteVerifyResult,
  context: AtD890WriteVerifyDebugContext,
): string {
  const lines = [
    '# AT-D890UV write verify — debug report',
    '',
    'Use this report to diagnose whether staged Web Serial upload bytes landed on flash',
    'after `END` commit. Compare authority is **staging chunks actually transmitted**, not',
    'the projected image. Verify runs in a **new** PROGRAM session after radio restart.',
    '',
    '## Environment',
    '',
    `- Measured: ${context.measuredAt}`,
    `- Studio: ${context.buildVersion ?? 'unknown'} (${context.buildEnv ?? 'unknown'})`,
  ];
  if (context.pageUrl) lines.push(`- Page: ${context.pageUrl}`);
  if (context.userAgent) lines.push(`- User agent: ${context.userAgent}`);
  lines.push(
    '',
    '## Session',
    '',
    `- Build id: \`${context.buildId}\``,
    `- Egress id: \`${context.egressId}\``,
    `- Format: \`${context.formatId}\` / profile \`${context.profileId}\``,
    `- Staging captured (pre-commit): ${result.stagingCapturedAt}`,
    '',
    '## Radio read',
    '',
    `- Model: ${result.model}`,
    `- Bytes read: ${result.totalBytesRead} (${(result.elapsedMs / 1000).toFixed(1)}s)`,
    `- Scope: all \`AT_D890_MEMORY_REGIONS\` plus targeted reads for RMW-preserved staging spill (digital contacts and analog address book excluded)`,
    '',
    '## Verdict',
    '',
    `- Overall: **${result.ok ? 'PASS' : 'FAIL'}**`,
    `- Staging: ${result.staging.mismatchedChunks} / ${result.staging.totalChunks} staged 16-byte chunks mismatched${result.staging.notReadChunks > 0 ? `, ${result.staging.notReadChunks} not read` : ''}${result.staging.excludedBookkeepingChunks > 0 ? ` (${result.staging.excludedBookkeepingChunks} bookkeeping blocks excluded)` : ''}`,
    `- Preserved settings (6 sentinels): **${result.sentinel.ok ? 'PASS' : 'FAIL'}**`,
    '',
  );

  if (result.cacheStaleness) {
    lines.push('## Cache staleness', '', result.cacheStaleness.message, '');
  }

  if (result.eraseUnits.length > 0) {
    lines.push(
      '## Erase-unit commit verdict',
      '',
      'Baseline is the **live radio** before overlay, not the last Download cache.',
      'A unit with **must-change > 0** and **changed == 0** did not commit to flash.',
      '**partial** means some but not all must-change chunks differ on flash after write.',
      '',
      '| unitBase | stagedChunks | mustChangeChunks | changedChunks | verdict |',
      '| --- | --- | --- | --- | --- |',
      ...result.eraseUnits.map(
        (u) =>
          `| ${hexAddr(u.unitBase)} | ${u.stagedChunks} | ${u.mustChangeChunks} | ${u.changedChunks} | **${u.verdict}** |`,
      ),
      '',
    );
  }

  lines.push(
    '## Regions',
    '',
    '| id | label | group | bytesRead | stagedChunks | mismatches | status |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...result.regions
      .filter((r) => r.status !== 'skipped')
      .map(
        (r) =>
          `| ${r.id} | ${r.label} | ${r.group} | ${r.bytesRead} | ${r.stagedChunkCount} | ${r.mismatchedChunks} | ${r.status} |`,
      ),
  );

  if (!result.sentinel.ok) {
    lines.push('', '## Preserved-settings mismatches', '');
    for (const m of result.sentinel.mismatches) {
      lines.push(`- \`${m.id}\` — ${m.label}`);
    }
  }

  const grouped = groupMismatchesByRegion(result.staging.mismatches);
  if (grouped.size > 0) {
    lines.push('', '## Staging mismatches by region', '');
    for (const [regionId, items] of [...grouped.entries()].sort((a, b) =>
      a[0].localeCompare(b[0]),
    )) {
      lines.push(`### ${regionId} (${items.length} chunks)`, '');
      lines.push('| address | expected (16 B) | actual (16 B) |');
      lines.push('| --- | --- | --- |');
      for (const m of items) {
        const actualCol = m.kind === 'not_read' ? '*(not read)*' : `\`${bytesToHex(m.actual!)}\``;
        lines.push(`| ${hexAddr(m.address)} | \`${bytesToHex(m.expected)}\` | ${actualCol} |`);
      }
      lines.push('');
    }
  }

  lines.push(
    '## Investigation hints',
    '',
    '1. **Staging mismatch, sentinel OK** — transport/erase issue: block not committed, wrong erase unit, or radio shadow not flushed. Check `sparseEraseRmw.ts`, `protocol.ts` upload loop, and hardware erase-unit boundaries.',
    '2. **Sentinel mismatch** — optional settings / alarm corrupted during sparse RMW inside a touched erase unit. Compare pre-write sentinel snapshot vs post-read.',
    '3. **Encoder vs transport** — if offline `staging.test.ts` passes against a memory dump but live verify fails, suspect timing (verify too early) or a different codeplug than staged.',
    '4. **not read** — address was staged but had no byte in the verify dump (modelled region gap or missing spill read). Do not treat as all-0xff; add spill addresses or extend the region read.',
    '5. **Erase-unit bookkeeping (outside modelled banks)** — per-unit blocks at +0x3fbf0 and +0x3fff0 in RMW spill are flash sector markers, not codeplug payload; verify excludes them only when outside declared region spans.',
    '6. **Partial byte diff** — single 16-byte block wrong: check codec for that region id in `src/integrations/radio-io/radios/at-d890uv/`.',
    '',
    '## Related code',
    '',
    '- `src/integrations/radio-io/radios/at-d890uv/writeMemoryVerify.ts`',
    '- `src/integrations/radio-io/radios/at-d890uv/protocol.ts` (`upload`)',
    '- `src/integrations/radio-io/radios/at-d890uv/sparseEraseRmw.ts`',
    '- `docs/reference/radios/anytone/at-d890uv/protocol.md`',
  );

  return lines.join('\n');
}

export { labelForAtD890SentinelId } from './sentinelVerify.ts';
export { AT_D890_BLOCK_SIZE } from './constants.ts';
