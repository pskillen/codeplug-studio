/**
 * AT-D890UV write-verify hooks — maps D890 compare engine to neutral WriteVerify types.
 */

import type {
  WriteVerifyCaptureResult,
  WriteVerifyDebugContext,
  WriteVerifyHooks,
  WriteVerifyKeptSnapshot,
  WriteVerifyResult,
  WriteVerifyStagingSnapshot,
} from '../../writeVerify.ts';
import type { RadioSession } from '../../types.ts';
import {
  runAtD890WriteVerifyMemoryRead,
  AT_D890_MEMORY_REGION_GROUPS,
} from './memoryRegionExport.ts';
import { AtD890uvProtocol } from './protocol.ts';
import type { AtD890SentinelSnapshot } from './sentinelVerify.ts';
import {
  AT_D890_RMW_SPILL_GROUP,
  buildAtD890WriteVerifyResult,
  formatAtD890WriteVerifyDebugMarkdown,
  listStagingAddressesOutsideModelledRegions,
  type AtD890WriteStagingSnapshot,
  type AtD890WriteVerifyResult,
} from './writeMemoryVerify.ts';

const AT_D890_VERIFY_ONLY_REGION_GROUPS = [
  { id: AT_D890_RMW_SPILL_GROUP, label: 'RMW-preserved spill' },
];

export interface AtD890KeptSnapshotJson extends WriteVerifyKeptSnapshot {
  readonly entries: readonly { readonly id: string; readonly data: readonly number[] }[];
}

export function serializeAtD890KeptSnapshot(
  snapshot: AtD890SentinelSnapshot,
): AtD890KeptSnapshotJson {
  return {
    entries: [...snapshot.entries()].map(([id, data]) => ({ id, data: [...data] })),
  };
}

export function deserializeAtD890KeptSnapshot(
  json: AtD890KeptSnapshotJson,
): AtD890SentinelSnapshot {
  const out = new Map<string, Uint8Array>();
  for (const { id, data } of json.entries) {
    out.set(id, Uint8Array.from(data));
  }
  return out;
}

function isAtD890KeptSnapshotJson(value: WriteVerifyKeptSnapshot): AtD890KeptSnapshotJson {
  const entries = value.entries;
  if (!Array.isArray(entries)) {
    throw new Error('Invalid AT-D890 kept snapshot payload.');
  }
  return value as AtD890KeptSnapshotJson;
}

function mapD890StagingSnapshot(staging: WriteVerifyStagingSnapshot): AtD890WriteStagingSnapshot {
  return {
    capturedAt: staging.capturedAt,
    chunks: staging.chunks.map((c) => ({ address: c.address, data: c.data })),
    preWriteChunks:
      staging.preWriteChunks?.map((c) => ({ address: c.address, data: c.data })) ?? [],
    downloadCacheChunks: staging.downloadCacheChunks?.map((c) => ({
      address: c.address,
      data: c.data,
    })),
  };
}

function mapD890ResultToNeutral(result: AtD890WriteVerifyResult): WriteVerifyResult {
  return {
    ok: result.ok,
    model: result.model,
    elapsedMs: result.elapsedMs,
    totalBytesRead: result.totalBytesRead,
    stagingCapturedAt: result.stagingCapturedAt,
    staging: {
      totalChunks: result.staging.totalChunks,
      excludedBookkeepingChunks: result.staging.excludedBookkeepingChunks,
      mismatchedChunks: result.staging.mismatchedChunks,
      notReadChunks: result.staging.notReadChunks,
      mismatches: result.staging.mismatches,
    },
    kept: result.sentinel.ok ? { ok: true } : { ok: false, mismatches: result.sentinel.mismatches },
    regions: result.regions,
    regionGroups: [...AT_D890_MEMORY_REGION_GROUPS, ...AT_D890_VERIFY_ONLY_REGION_GROUPS],
    eraseUnits: result.eraseUnits,
    cacheStaleness: result.cacheStaleness,
  };
}

function mapNeutralDebugContext(context: WriteVerifyDebugContext) {
  return {
    buildId: context.buildId,
    egressId: context.egressId,
    formatId: context.formatId,
    profileId: context.profileId,
    measuredAt: context.measuredAt,
    buildVersion: context.buildVersion,
    buildEnv: context.buildEnv,
    pageUrl: context.pageUrl,
    userAgent: context.userAgent,
  };
}

function mapD890ResultFromNeutralForMarkdown(result: WriteVerifyResult): AtD890WriteVerifyResult {
  return {
    ok: result.ok,
    model: result.model,
    elapsedMs: result.elapsedMs,
    totalBytesRead: result.totalBytesRead,
    stagingCapturedAt: result.stagingCapturedAt,
    staging: {
      totalChunks: result.staging.totalChunks,
      excludedBookkeepingChunks: result.staging.excludedBookkeepingChunks ?? 0,
      mismatchedChunks: result.staging.mismatchedChunks,
      notReadChunks: result.staging.notReadChunks ?? 0,
      mismatches: result.staging.mismatches,
    },
    sentinel: result.kept?.ok
      ? { ok: true }
      : { ok: false, mismatches: result.kept?.mismatches ?? [] },
    regions: result.regions,
    eraseUnits: result.eraseUnits ?? [],
    cacheStaleness: result.cacheStaleness,
  };
}

export const AT_D890_WRITE_VERIFY_HOOKS: WriteVerifyHooks = {
  requiresCrossSessionReconnect: true,

  captureAfterUpload(session: RadioSession): WriteVerifyCaptureResult | undefined {
    if (!(session.radio instanceof AtD890uvProtocol)) return undefined;
    const stagingSnapshot = session.radio.takeUploadStagingSnapshot();
    if (!stagingSnapshot) return undefined;
    const sentinelBefore = session.radio.takeUploadSentinelSnapshot();
    return {
      staging: {
        capturedAt: stagingSnapshot.capturedAt,
        chunks: stagingSnapshot.chunks.map((c) => ({
          address: c.address,
          data: c.data,
        })),
        preWriteChunks: stagingSnapshot.preWriteChunks.map((c) => ({
          address: c.address,
          data: c.data,
        })),
        downloadCacheChunks: stagingSnapshot.downloadCacheChunks?.map((c) => ({
          address: c.address,
          data: c.data,
        })),
      },
      kept: sentinelBefore ? serializeAtD890KeptSnapshot(sentinelBefore) : undefined,
    };
  },

  async runVerify(session, pending, opts): Promise<WriteVerifyResult> {
    if (!(session.radio instanceof AtD890uvProtocol)) {
      throw new Error('Write verify is only supported for AT-D890UV.');
    }
    const stagingSnapshot = mapD890StagingSnapshot(pending.staging);
    const sentinelBefore = pending.kept
      ? deserializeAtD890KeptSnapshot(isAtD890KeptSnapshotJson(pending.kept))
      : undefined;
    const spillAddresses = listStagingAddressesOutsideModelledRegions(stagingSnapshot);
    const dump = await runAtD890WriteVerifyMemoryRead(session.pipe, spillAddresses, {
      onProgress: opts?.onProgress,
      signal: opts?.signal,
    });
    const result = buildAtD890WriteVerifyResult(
      stagingSnapshot,
      dump.files,
      sentinelBefore,
      {
        model: dump.model,
        elapsedMs: dump.elapsedMs,
        totalBytesRead: dump.totalBytes,
      },
      dump.spillChunks,
    );
    return mapD890ResultToNeutral(result);
  },

  formatDebugMarkdown(result, context): string {
    return formatAtD890WriteVerifyDebugMarkdown(
      mapD890ResultFromNeutralForMarkdown(result),
      mapNeutralDebugContext(context),
    );
  },
};
