/**
 * Radio-neutral staging compare helpers for full-image / dirty-sector write verify adapters.
 */

import type { MemoryMap } from './types.ts';
import type {
  WriteVerifyMismatch,
  WriteVerifyRegionGroup,
  WriteVerifyRegionRow,
  WriteVerifyRegionStatus,
  WriteVerifyResult,
  WriteVerifyStagingSnapshot,
} from './writeVerify.ts';

export interface WriteVerifyRegionManifestEntry {
  readonly id: string;
  readonly label: string;
  readonly group: string;
  readonly start: number;
  readonly length: number;
}

export interface WriteVerifyByteLookup {
  get(address: number, length: number): Uint8Array | null;
}

/** Contiguous MemoryMap lookup — optional mapper when staged addresses differ from map offsets. */
export function memoryMapByteLookup(
  map: MemoryMap,
  addressToOffset: (address: number) => number = (address) => address,
): WriteVerifyByteLookup {
  return {
    get(address: number, length: number): Uint8Array | null {
      const offset = addressToOffset(address);
      if (offset < 0 || offset + length > map.size) return null;
      return map.get(offset, length);
    },
  };
}

/** Sparse absolute-address blocks (e.g. DM-32UV 4 KB chunks). */
export function sparseBlockByteLookup(
  blocks: ReadonlyMap<number, Uint8Array>,
): WriteVerifyByteLookup {
  return {
    get(address: number, length: number): Uint8Array | null {
      for (const [blockAddr, data] of blocks) {
        if (address >= blockAddr && address + length <= blockAddr + data.length) {
          return data.subarray(address - blockAddr, address - blockAddr + length);
        }
      }
      return null;
    },
  };
}

export function regionAtFromManifest(
  manifest: readonly WriteVerifyRegionManifestEntry[],
  address: number,
): { id: string; label: string } | undefined {
  for (const region of manifest) {
    if (address >= region.start && address < region.start + region.length) {
      return { id: region.id, label: region.label };
    }
  }
  return undefined;
}

function chunksEqual(expected: Uint8Array, actual: Uint8Array): boolean {
  if (expected.length !== actual.length) return false;
  for (let i = 0; i < expected.length; i++) {
    if (expected[i] !== actual[i]) return false;
  }
  return true;
}

export function compareStagingAgainstLookup(
  staging: WriteVerifyStagingSnapshot,
  lookup: WriteVerifyByteLookup,
  regionAt: (address: number) => { id: string; label: string } | undefined,
): WriteVerifyMismatch[] {
  const mismatches: WriteVerifyMismatch[] = [];

  for (const { address, data } of staging.chunks) {
    const actual = lookup.get(address, data.length);
    const region = regionAt(address);
    if (actual === null) {
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

  return mismatches;
}

export function summarizeWriteVerifyRegions(
  staging: WriteVerifyStagingSnapshot,
  mismatches: readonly WriteVerifyMismatch[],
  manifest: readonly WriteVerifyRegionManifestEntry[],
  bytesReadForRegion: (regionId: string) => number,
): WriteVerifyRegionRow[] {
  const stagedCountByRegion = new Map<string, number>();
  const mismatchCountByRegion = new Map<string, number>();

  for (const { address } of staging.chunks) {
    const region = regionAtFromManifest(manifest, address);
    const regionId = region?.id ?? 'unknown';
    stagedCountByRegion.set(regionId, (stagedCountByRegion.get(regionId) ?? 0) + 1);
  }

  for (const m of mismatches) {
    mismatchCountByRegion.set(m.regionId, (mismatchCountByRegion.get(m.regionId) ?? 0) + 1);
  }

  return manifest.map((region) => {
    const bytesRead = bytesReadForRegion(region.id);
    const stagedChunkCount = stagedCountByRegion.get(region.id) ?? 0;
    const mismatchedChunks = mismatchCountByRegion.get(region.id) ?? 0;
    let status: WriteVerifyRegionStatus;
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
      id: region.id,
      label: region.label,
      group: region.group,
      bytesRead,
      stagedChunkCount,
      mismatchedChunks,
      status,
    };
  });
}

export function buildWriteVerifyResult(input: {
  model: string;
  elapsedMs: number;
  totalBytesRead: number;
  staging: WriteVerifyStagingSnapshot;
  mismatches: readonly WriteVerifyMismatch[];
  regions: readonly WriteVerifyRegionRow[];
  regionGroups: readonly WriteVerifyRegionGroup[];
}): WriteVerifyResult {
  const notReadChunks = input.mismatches.filter((m) => m.kind === 'not_read').length;
  const mismatchedChunks = input.mismatches.filter((m) => m.kind === 'mismatch').length;
  return {
    ok: input.mismatches.length === 0,
    model: input.model,
    elapsedMs: input.elapsedMs,
    totalBytesRead: input.totalBytesRead,
    stagingCapturedAt: input.staging.capturedAt,
    staging: {
      totalChunks: input.staging.chunks.length,
      mismatchedChunks,
      notReadChunks,
      mismatches: input.mismatches,
    },
    regions: input.regions,
    regionGroups: input.regionGroups,
  };
}

export function captureWriteVerifyStaging(
  chunks: readonly { address: number; data: Uint8Array }[],
): WriteVerifyStagingSnapshot {
  return {
    capturedAt: new Date().toISOString(),
    chunks: chunks.map((c) => ({ address: c.address, data: c.data.slice() })),
  };
}

export function formatWriteVerifyDebugMarkdown(
  result: WriteVerifyResult,
  context: import('./writeVerify.ts').WriteVerifyDebugContext,
  hints: readonly string[] = [],
): string {
  const lines: string[] = [
    '# Write verify debug export',
    '',
    `**Model:** ${result.model}`,
    `**Measured:** ${context.measuredAt}`,
    `**Build:** ${context.buildId} · egress ${context.egressId}`,
    `**Profile:** ${context.formatId} / ${context.profileId}`,
    `**OK:** ${result.ok}`,
    `**Elapsed:** ${result.elapsedMs} ms · **Bytes read:** ${result.totalBytesRead}`,
    `**Staging captured:** ${result.stagingCapturedAt}`,
    `**Chunks:** ${result.staging.totalChunks} · mismatched ${result.staging.mismatchedChunks} · not read ${result.staging.notReadChunks ?? 0}`,
    '',
    '## Regions',
    '',
    '| Region | Status | Staged | Mismatched | Bytes read |',
    '| --- | --- | --- | --- | --- |',
    ...result.regions.map(
      (r) =>
        `| ${r.label} | ${r.status} | ${r.stagedChunkCount} | ${r.mismatchedChunks} | ${r.bytesRead} |`,
    ),
  ];
  if (result.staging.mismatches.length > 0) {
    lines.push('', '## Mismatches', '');
    for (const m of result.staging.mismatches) {
      lines.push(
        `- **${m.kind}** @ 0x${m.address.toString(16)} (${m.regionLabel})`,
        `  - expected: ${[...m.expected].map((b) => b.toString(16).padStart(2, '0')).join(' ')}`,
      );
      if (m.actual) {
        lines.push(
          `  - actual: ${[...m.actual].map((b) => b.toString(16).padStart(2, '0')).join(' ')}`,
        );
      }
    }
  }
  if (hints.length > 0) {
    lines.push('', '## Hints', '', ...hints.map((h) => `- ${h}`));
  }
  return lines.join('\n');
}
