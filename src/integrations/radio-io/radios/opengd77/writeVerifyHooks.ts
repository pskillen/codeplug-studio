/**
 * OpenGD77 write-verify hooks — dirty-sector staging + kept region compare.
 */

import type {
  WriteVerifyCaptureResult,
  WriteVerifyDebugContext,
  WriteVerifyHooks,
  WriteVerifyKeptCompareResult,
  WriteVerifyKeptSnapshot,
  WriteVerifyPendingPayload,
  WriteVerifyRegionGroup,
  WriteVerifyResult,
} from '../../writeVerify.ts';
import type { RadioSession } from '../../types.ts';
import {
  buildWriteVerifyResult,
  compareStagingAgainstLookup,
  formatWriteVerifyDebugMarkdown,
  memoryMapByteLookup,
  regionAtFromManifest,
  summarizeWriteVerifyRegions,
} from '../../writeVerifyCompare.ts';
import { openUv380AbsToOffset } from './constants.ts';
import { readAbs } from './memory.ts';
import { OpenGd77Protocol } from './protocol.ts';
import {
  buildOpenGd77VerifyManifest,
  keptRegionOverlapsStaging,
  openGd77KeptRegions,
} from './writeVerifySupport.ts';
import {
  compareUserDatabaseReadback,
  OPENGD77_USER_DATABASE_VERIFY_GROUP_ID,
  type OpenGd77UserDatabaseVerifySnapshot,
} from './userDatabaseVerify.ts';
import { captureWriteVerifyStaging } from '../../writeVerifyCompare.ts';
import { memoryMapToBytes } from '../../kit/memoryMap.ts';

const OPENGD77_VERIFY_REGION_GROUPS: readonly WriteVerifyRegionGroup[] = [
  { id: 'replaced', label: 'Written from build' },
  { id: 'kept', label: 'Retained from radio' },
  { id: OPENGD77_USER_DATABASE_VERIFY_GROUP_ID, label: 'User Database' },
];

export interface OpenGd77KeptSnapshotJson extends WriteVerifyKeptSnapshot {
  readonly entries: readonly { readonly id: string; readonly data: readonly number[] }[];
  /** Digest of the User Database bytes the Write sent; absent when it sent none. */
  readonly userDatabase?: OpenGd77UserDatabaseVerifySnapshot;
}

function serializeKeptSnapshot(
  kept: Map<string, Uint8Array> | undefined,
  userDatabase: OpenGd77UserDatabaseVerifySnapshot | undefined,
): OpenGd77KeptSnapshotJson {
  return {
    entries: kept ? [...kept.entries()].map(([id, data]) => ({ id, data: [...data] })) : [],
    ...(userDatabase ? { userDatabase } : {}),
  };
}

function deserializeKeptSnapshot(json: WriteVerifyKeptSnapshot): Map<string, Uint8Array> {
  const entries = json.entries;
  if (!Array.isArray(entries)) {
    throw new Error('Invalid OpenGD77 kept snapshot payload.');
  }
  const out = new Map<string, Uint8Array>();
  for (const entry of entries as OpenGd77KeptSnapshotJson['entries']) {
    out.set(entry.id, Uint8Array.from(entry.data));
  }
  return out;
}

function compareKeptRegions(
  before: Map<string, Uint8Array>,
  image: Parameters<typeof readAbs>[0],
  staging: WriteVerifyPendingPayload['staging'],
  manifest: ReturnType<typeof buildOpenGd77VerifyManifest>,
): WriteVerifyKeptCompareResult {
  const mismatches: { id: string; label: string }[] = [];
  for (const region of openGd77KeptRegions()) {
    if (keptRegionOverlapsStaging(region.id, manifest, staging)) {
      continue;
    }
    const expected = before.get(region.id);
    if (!expected) continue;
    const actual = readAbs(image, region.absAddress, expected.length);
    if (expected.length !== actual.length) {
      mismatches.push({ id: region.id, label: region.label });
      continue;
    }
    for (let i = 0; i < expected.length; i++) {
      if (expected[i] !== actual[i]) {
        mismatches.push({ id: region.id, label: region.label });
        break;
      }
    }
  }
  return mismatches.length === 0 ? { ok: true } : { ok: false, mismatches };
}

export function createOpenGd77WriteVerifyHooks(modelId: string): WriteVerifyHooks {
  const manifest = buildOpenGd77VerifyManifest();

  return {
    requiresCrossSessionReconnect: true,

    captureAfterUpload(session: RadioSession): WriteVerifyCaptureResult | undefined {
      if (!(session.radio instanceof OpenGd77Protocol)) return undefined;
      const userDatabase = session.radio.takeUploadUserDatabaseSnapshot();
      // A User-Database-only Write has no codeplug staging; it still has something to check.
      const staging =
        session.radio.takeUploadStagingSnapshot() ??
        (userDatabase ? captureWriteVerifyStaging([]) : undefined);
      if (!staging) return undefined;
      const keptMap = session.radio.takeUploadKeptSnapshot();
      return {
        staging,
        kept: keptMap || userDatabase ? serializeKeptSnapshot(keptMap, userDatabase) : undefined,
      };
    },

    async runVerify(session, pending: WriteVerifyPendingPayload, opts): Promise<WriteVerifyResult> {
      if (!(session.radio instanceof OpenGd77Protocol)) {
        throw new Error('Write verify is only supported for OpenGD77 radios.');
      }
      const started = performance.now();
      const image = await session.radio.download({
        onProgress: opts?.onProgress,
        signal: opts?.signal,
      });
      const lookup = memoryMapByteLookup(image, openUv380AbsToOffset);
      const mismatches = compareStagingAgainstLookup(pending.staging, lookup, (addr) =>
        regionAtFromManifest(manifest, addr),
      );
      const regions = summarizeWriteVerifyRegions(
        pending.staging,
        mismatches,
        manifest,
        (id) => manifest.find((r) => r.id === id)?.length ?? 0,
      );
      const keptBefore = pending.kept ? deserializeKeptSnapshot(pending.kept) : undefined;
      const kept = keptBefore
        ? compareKeptRegions(keptBefore, image, pending.staging, manifest)
        : undefined;
      const udbSnapshot = (pending.kept as OpenGd77KeptSnapshotJson | undefined)?.userDatabase;
      const udb = udbSnapshot
        ? compareUserDatabaseReadback(
            udbSnapshot,
            await session.radio.downloadUserDatabaseOccupied({
              onProgress: opts?.onProgress,
              signal: opts?.signal,
              keepInvalidHeader: true,
            }),
          )
        : undefined;
      const base = buildWriteVerifyResult({
        model: modelId,
        elapsedMs: Math.round(performance.now() - started),
        totalBytesRead: memoryMapToBytes(image).length + (udb?.region.bytesRead ?? 0),
        staging: pending.staging,
        mismatches,
        regions,
        regionGroups: OPENGD77_VERIFY_REGION_GROUPS,
      });
      const result: WriteVerifyResult = udb
        ? {
            ...base,
            ok: base.ok && udb.mismatches.length === 0,
            staging: {
              ...base.staging,
              totalChunks: base.staging.totalChunks + udb.chunkCount,
              mismatchedChunks:
                base.staging.mismatchedChunks +
                udb.mismatches.filter((m) => m.kind === 'mismatch').length,
              notReadChunks:
                (base.staging.notReadChunks ?? 0) +
                udb.mismatches.filter((m) => m.kind === 'not_read').length,
              mismatches: [...base.staging.mismatches, ...udb.mismatches],
            },
            regions: [...base.regions, udb.region],
          }
        : base;
      return kept ? { ...result, ok: result.ok && kept.ok, kept } : result;
    },

    formatDebugMarkdown(result: WriteVerifyResult, context: WriteVerifyDebugContext): string {
      return formatWriteVerifyDebugMarkdown(result, context, [
        'OpenGD77 verify compares dirty FLASH sectors actually programmed and checks kept regions against pre-upload snapshots. When the Write sent a User Database, the header and occupied entries are read back and compared by per-sector CRC-32.',
        'SAVE_REBOOT at upload end — wait for radio restart before Verify write.',
      ]);
    },
  };
}
