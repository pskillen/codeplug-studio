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
import type { WriteVerifyStagingSnapshot } from '../../writeVerify.ts';
import { RT95_MODEL_ID } from './constants.ts';
import { MMD1_BASE } from './modData/index.ts';
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

/** MMD1 regions, added to the manifest when a Write staged blocks at or above 0x4000. */
const RT95_MM9PDY_VERIFY_REGIONS: readonly WriteVerifyRegionManifestEntry[] = [
  { id: 'zones', label: 'Zones', group: 'replaced', start: 0x4000, length: 0x4700 - 0x4000 },
  {
    id: 'descriptions',
    label: 'Channel descriptions',
    group: 'replaced',
    start: 0x5000,
    length: 0x5c80 - 0x5000,
  },
];

function manifestFor(
  staging: WriteVerifyStagingSnapshot,
): readonly WriteVerifyRegionManifestEntry[] {
  return staging.chunks.some((c) => c.address >= MMD1_BASE)
    ? [...RT95_VERIFY_MANIFEST, ...RT95_MM9PDY_VERIFY_REGIONS]
    : RT95_VERIFY_MANIFEST;
}

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
    // Write ends with END; the radio ignores PROGRAM for a few seconds while it reloads.
    await session.radio.ensureProgramMode({ signal: opts?.signal, onProgress: opts?.onProgress });
    const started = performance.now();
    const image = await session.radio.download({
      onProgress: opts?.onProgress,
      signal: opts?.signal,
    });
    const elapsedMs = Math.round(performance.now() - started);
    // MMD1 blocks sit above the stock image: read each staged one back by address.
    const modAddresses = pending.staging.chunks
      .map((c) => c.address)
      .filter((address) => address >= MMD1_BASE);
    const modBlocks =
      modAddresses.length > 0
        ? await session.radio.readBlocks(modAddresses, { signal: opts?.signal })
        : new Map<number, Uint8Array>();
    const base = memoryMapByteLookup(image);
    const lookup = {
      get: (address: number, length: number): Uint8Array | null =>
        address >= MMD1_BASE
          ? (modBlocks.get(address)?.slice(0, length) ?? null)
          : base.get(address, length),
    };
    const manifest = manifestFor(pending.staging);
    const mismatches = compareStagingAgainstLookup(pending.staging, lookup, (addr) =>
      regionAtFromManifest(manifest, addr),
    );
    const regions = summarizeWriteVerifyRegions(pending.staging, mismatches, manifest, (id) => {
      const region = manifest.find((r) => r.id === id);
      if (!region) return 0;
      if (region.start >= MMD1_BASE) {
        return (
          [...modBlocks.keys()].filter((a) => a >= region.start && a < region.start + region.length)
            .length * 16
        );
      }
      return regionBytesRead(image.size, region);
    });
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
      ...(result.regions.some((r) => r.id === 'zones' || r.id === 'descriptions')
        ? ['…and the MM9PDY blocks written in 0x4000–0x5FF0.']
        : []),
    ]);
  },
};
