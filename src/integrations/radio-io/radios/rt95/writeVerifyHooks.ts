/**
 * RT95 write-verify hooks — full-image clone compare after download.
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
import { RT95_MODEL_ID } from './constants.ts';
import { Rt95Protocol } from './protocol.ts';
import { RT95_REGION_MANIFEST } from './writeRole.ts';

const RT95_VERIFY_REGION_GROUPS: readonly WriteVerifyRegionGroup[] = [
  { id: 'replaced', label: 'Written from build' },
  { id: 'kept', label: 'Retained from radio' },
];

const RT95_VERIFY_MANIFEST: readonly WriteVerifyRegionManifestEntry[] = RT95_REGION_MANIFEST.map(
  (r) => ({
    id: r.id,
    label: r.label,
    group: r.role,
    start: r.offset,
    length: r.length,
  }),
);

function regionBytesRead(imageSize: number, region: WriteVerifyRegionManifestEntry): number {
  const end = Math.min(region.start + region.length, imageSize);
  return Math.max(0, end - region.start);
}

export const RT95_WRITE_VERIFY_HOOKS: WriteVerifyHooks = {
  requiresCrossSessionReconnect: false,

  captureAfterUpload(session: RadioSession): WriteVerifyCaptureResult | undefined {
    if (!(session.radio instanceof Rt95Protocol)) return undefined;
    const staging = session.radio.takeUploadStagingSnapshot();
    if (!staging) return undefined;
    return { staging };
  },

  async runVerify(session, pending: WriteVerifyPendingPayload, opts): Promise<WriteVerifyResult> {
    if (!(session.radio instanceof Rt95Protocol)) {
      throw new Error('Write verify is only supported for RT95.');
    }
    const started = performance.now();
    const image = await session.radio.download({
      onProgress: opts?.onProgress,
      signal: opts?.signal,
    });
    const elapsedMs = Math.round(performance.now() - started);
    const lookup = memoryMapByteLookup(image);
    const mismatches = compareStagingAgainstLookup(pending.staging, lookup, (addr) =>
      regionAtFromManifest(RT95_VERIFY_MANIFEST, addr),
    );
    const regions = summarizeWriteVerifyRegions(
      pending.staging,
      mismatches,
      RT95_VERIFY_MANIFEST,
      (id) => {
        const region = RT95_VERIFY_MANIFEST.find((r) => r.id === id);
        return region ? regionBytesRead(image.size, region) : 0;
      },
    );
    return buildWriteVerifyResult({
      model: RT95_MODEL_ID,
      elapsedMs,
      totalBytesRead: memoryMapToBytes(image).length,
      staging: pending.staging,
      mismatches,
      regions,
      regionGroups: RT95_VERIFY_REGION_GROUPS,
    });
  },

  formatDebugMarkdown(result: WriteVerifyResult, context: WriteVerifyDebugContext): string {
    return formatWriteVerifyDebugMarkdown(result, context, [
      'RT95 verify compares every 16-byte block transmitted in 0x0000–0x3290 against a full download.',
    ]);
  },
};
