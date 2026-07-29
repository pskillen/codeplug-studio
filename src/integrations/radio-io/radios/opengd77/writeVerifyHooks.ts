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
import { memoryMapToBytes } from '../../kit/memoryMap.ts';

const OPENGD77_VERIFY_REGION_GROUPS: readonly WriteVerifyRegionGroup[] = [
  { id: 'replaced', label: 'Written from build' },
  { id: 'kept', label: 'Retained from radio' },
];

export interface OpenGd77KeptSnapshotJson extends WriteVerifyKeptSnapshot {
  readonly entries: readonly { readonly id: string; readonly data: readonly number[] }[];
}

function serializeKeptSnapshot(kept: Map<string, Uint8Array>): OpenGd77KeptSnapshotJson {
  return {
    entries: [...kept.entries()].map(([id, data]) => ({ id, data: [...data] })),
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
      const staging = session.radio.takeUploadStagingSnapshot();
      if (!staging) return undefined;
      const keptMap = session.radio.takeUploadKeptSnapshot();
      return {
        staging,
        kept: keptMap ? serializeKeptSnapshot(keptMap) : undefined,
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
      const elapsedMs = Math.round(performance.now() - started);
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
      const result = buildWriteVerifyResult({
        model: modelId,
        elapsedMs,
        totalBytesRead: memoryMapToBytes(image).length,
        staging: pending.staging,
        mismatches,
        regions,
        regionGroups: OPENGD77_VERIFY_REGION_GROUPS,
      });
      return kept ? { ...result, ok: result.ok && kept.ok, kept } : result;
    },

    formatDebugMarkdown(result: WriteVerifyResult, context: WriteVerifyDebugContext): string {
      return formatWriteVerifyDebugMarkdown(result, context, [
        'OpenGD77 verify compares dirty FLASH sectors actually programmed and checks kept regions against pre-upload snapshots.',
        'SAVE_REBOOT at upload end — wait for radio restart before Verify write.',
      ]);
    },
  };
}
