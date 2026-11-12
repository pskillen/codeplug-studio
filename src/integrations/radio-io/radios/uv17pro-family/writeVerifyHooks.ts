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

/**
 * A span outside the clone that a modified-firmware target writes (the UV-5R Mini MM9PDY zone table). When the
 * staging holds frames in it, verify reads every block of the span back by radio address and compares the
 * written frames. Addresses are radio addresses, above the packed image.
 */
export interface Uv17ProVerifyExtraSpan {
  id: string;
  label: string;
  /** Inclusive radio address. */
  start: number;
  /** Exclusive radio address. */
  end: number;
}

export function createUv17ProWriteVerifyHooks(
  layout: Uv17ProLayout,
  options: { extraSpan?: Uv17ProVerifyExtraSpan } = {},
): WriteVerifyHooks {
  const baseManifest = buildVerifyManifest(layout);
  const extraSpan = options.extraSpan;
  const inExtra = (addr: number): boolean =>
    extraSpan !== undefined && addr >= extraSpan.start && addr < extraSpan.end;

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
      // Frames outside the clone (extra span): read the whole span back by radio address.
      const extraStaged =
        extraSpan !== undefined && pending.staging.chunks.some((c) => inExtra(c.address));
      const extraBlocks = new Map<number, Uint8Array>();
      if (extraSpan && extraStaged) {
        const addrs: number[] = [];
        for (let a = extraSpan.start; a < extraSpan.end; a += layout.blockSize) addrs.push(a);
        const read = await session.radio.readBlocks(addrs, { signal: opts?.signal });
        for (const [a, b] of read) extraBlocks.set(a, b);
      }
      const elapsedMs = Math.round(performance.now() - started);
      const base = memoryMapByteLookup(image, (radioAddr) =>
        packedOffsetForRadioAddr(layout, radioAddr),
      );
      const lookup = {
        get: (address: number, length: number): Uint8Array | null => {
          if (!inExtra(address)) return base.get(address, length);
          const blockStart = address - ((address - extraSpan!.start) % layout.blockSize);
          const block = extraBlocks.get(blockStart);
          if (!block) return null;
          const off = address - blockStart;
          return off + length <= block.length ? block.slice(off, off + length) : null;
        },
      };
      const extraRegion: WriteVerifyRegionManifestEntry | undefined =
        extraSpan && extraStaged
          ? {
              id: extraSpan.id,
              label: extraSpan.label,
              group: 'replaced',
              start: extraSpan.start,
              length: extraSpan.end - extraSpan.start,
            }
          : undefined;
      const manifest = extraRegion ? [...baseManifest, extraRegion] : baseManifest;
      const mismatches = compareStagingAgainstLookup(pending.staging, lookup, (addr) => {
        if (inExtra(addr)) return extraRegion;
        const packed = packedOffsetForRadioAddr(layout, addr);
        return regionAtFromManifest(baseManifest, packed);
      });
      const regions = summarizeWriteVerifyRegions(pending.staging, mismatches, manifest, (id) => {
        if (extraRegion && id === extraRegion.id) return extraBlocks.size * layout.blockSize;
        const region = manifest.find((r) => r.id === id);
        return region ? regionBytesRead(image.size, region) : 0;
      });
      return buildWriteVerifyResult({
        model: layout.radioModelId,
        elapsedMs,
        totalBytesRead: memoryMapToBytes(image).length + extraBlocks.size * layout.blockSize,
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
