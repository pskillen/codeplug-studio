/**
 * UV-17Pro family write-verify hooks — plaintext blocks at radio addresses.
 */

import type {
  WriteVerifyCaptureResult,
  WriteVerifyDebugContext,
  WriteVerifyHooks,
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
  type WriteVerifyRegionManifestEntry,
} from '../../writeVerifyCompare.ts';
import { memoryMapToBytes } from '../../kit/memoryMap.ts';
import type { Uv17ProLayout } from './layout.ts';
import { packedOffsetForRadioAddr, Uv17ProProtocol } from './protocol.ts';
import { buildUv17ProRegionManifest } from './writeRole.ts';

const UV17_VERIFY_REGION_GROUPS: readonly WriteVerifyRegionGroup[] = [
  { id: 'replaced', label: 'Written from build' },
  { id: 'kept', label: 'Retained from radio' },
];

function buildVerifyManifest(layout: Uv17ProLayout): readonly WriteVerifyRegionManifestEntry[] {
  return buildUv17ProRegionManifest(layout).map((r) => ({
    id: r.id,
    label: r.label,
    group: r.writeRole,
    start: r.packedOffset,
    length: r.sizeBytes,
  }));
}

function regionBytesRead(imageSize: number, region: WriteVerifyRegionManifestEntry): number {
  const end = Math.min(region.start + region.length, imageSize);
  return Math.max(0, end - region.start);
}

export function createUv17ProWriteVerifyHooks(layout: Uv17ProLayout): WriteVerifyHooks {
  const manifest = buildVerifyManifest(layout);

  return {
    requiresCrossSessionReconnect: false,

    captureAfterUpload(session: RadioSession): WriteVerifyCaptureResult | undefined {
      if (!(session.radio instanceof Uv17ProProtocol)) return undefined;
      const staging = session.radio.takeUploadStagingSnapshot();
      if (!staging) return undefined;
      return { staging };
    },

    async runVerify(session, pending: WriteVerifyPendingPayload, opts): Promise<WriteVerifyResult> {
      if (!(session.radio instanceof Uv17ProProtocol)) {
        throw new Error(`Write verify is only supported for ${layout.protocolLabel}.`);
      }
      const started = performance.now();
      const image = await session.radio.download({
        onProgress: opts?.onProgress,
        signal: opts?.signal,
      });
      const elapsedMs = Math.round(performance.now() - started);
      const lookup = memoryMapByteLookup(image, (radioAddr) =>
        packedOffsetForRadioAddr(layout, radioAddr),
      );
      const mismatches = compareStagingAgainstLookup(pending.staging, lookup, (addr) => {
        const packed = packedOffsetForRadioAddr(layout, addr);
        return regionAtFromManifest(manifest, packed);
      });
      const regions = summarizeWriteVerifyRegions(pending.staging, mismatches, manifest, (id) => {
        const region = manifest.find((r) => r.id === id);
        return region ? regionBytesRead(image.size, region) : 0;
      });
      return buildWriteVerifyResult({
        model: layout.radioModelId,
        elapsedMs,
        totalBytesRead: memoryMapToBytes(image).length,
        staging: pending.staging,
        mismatches,
        regions,
        regionGroups: UV17_VERIFY_REGION_GROUPS,
      });
    },

    formatDebugMarkdown(result: WriteVerifyResult, context: WriteVerifyDebugContext): string {
      return formatWriteVerifyDebugMarkdown(result, context, [
        `${layout.protocolLabel} verify stages plaintext 64-byte blocks at radio addresses and compares after decrypting a full download.`,
      ]);
    },
  };
}
