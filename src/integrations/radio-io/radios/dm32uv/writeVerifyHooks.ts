/**
 * DM-32UV write-verify hooks — post-remap 4 KB sparse block compare.
 */

import type {
  WriteVerifyCaptureResult,
  WriteVerifyDebugContext,
  WriteVerifyHooks,
  WriteVerifyPendingPayload,
  WriteVerifyRegionGroup,
  WriteVerifyResult,
  WriteVerifyStagingSnapshot,
} from '../../writeVerify.ts';
import type { RadioSession } from '../../types.ts';
import {
  buildWriteVerifyResult,
  compareStagingAgainstLookup,
  formatWriteVerifyDebugMarkdown,
  regionAtFromManifest,
  sparseBlockByteLookup,
  summarizeWriteVerifyRegions,
  type WriteVerifyRegionManifestEntry,
} from '../../writeVerifyCompare.ts';
import { DM32_BLOCK_SIZE, DM32_METADATA_OFFSET, DM32UV_MODEL_ID } from './constants.ts';
import { bulkReadDm32Blocks, classifyDm32Metadata } from './memory.ts';
import { Dm32uvProtocol } from './protocol.ts';
import { dm32BlockLabel, dm32WriteRole } from './writeRole.ts';

const DM32_VERIFY_REGION_GROUPS: readonly WriteVerifyRegionGroup[] = [
  { id: 'replaced', label: 'Written from build' },
  { id: 'kept', label: 'Retained from radio' },
];

function metadataFromBlock(data: Uint8Array): number {
  return data[DM32_METADATA_OFFSET] ?? 0xff;
}

function buildDm32VerifyManifest(
  staging: WriteVerifyStagingSnapshot,
): readonly WriteVerifyRegionManifestEntry[] {
  return staging.chunks.map((chunk) => {
    const metadata = metadataFromBlock(chunk.data);
    const type = classifyDm32Metadata(metadata);
    const role = dm32WriteRole(metadata, type, { address: chunk.address });
    return {
      id: `block_${chunk.address.toString(16)}`,
      label: dm32BlockLabel(metadata, type),
      group: role,
      start: chunk.address,
      length: DM32_BLOCK_SIZE,
    };
  });
}

export const DM32_WRITE_VERIFY_HOOKS: WriteVerifyHooks = {
  requiresCrossSessionReconnect: false,

  captureAfterUpload(session: RadioSession): WriteVerifyCaptureResult | undefined {
    if (!(session.radio instanceof Dm32uvProtocol)) return undefined;
    const staging = session.radio.takeUploadStagingSnapshot();
    if (!staging) return undefined;
    return { staging };
  },

  async runVerify(session, pending: WriteVerifyPendingPayload, opts): Promise<WriteVerifyResult> {
    if (!(session.radio instanceof Dm32uvProtocol)) {
      throw new Error('Write verify is only supported for DM-32UV.');
    }
    const manifest = buildDm32VerifyManifest(pending.staging);
    const blocks = pending.staging.chunks.map((chunk) => {
      const metadata = metadataFromBlock(chunk.data);
      return {
        address: chunk.address,
        metadata,
        type: classifyDm32Metadata(metadata),
      };
    });
    const started = performance.now();
    const readBlocks = await bulkReadDm32Blocks(session.pipe, blocks, {
      signal: opts?.signal,
      onProgress: opts?.onProgress,
      stage: 'Verify read-back',
    });
    const elapsedMs = Math.round(performance.now() - started);
    const totalBytesRead = [...readBlocks.values()].reduce((sum, data) => sum + data.length, 0);
    const mismatches = compareStagingAgainstLookup(
      pending.staging,
      sparseBlockByteLookup(readBlocks),
      (addr) => regionAtFromManifest(manifest, addr),
    );
    const regions = summarizeWriteVerifyRegions(
      pending.staging,
      mismatches,
      manifest,
      (id) => manifest.find((r) => r.id === id)?.length ?? 0,
    );
    return buildWriteVerifyResult({
      model: DM32UV_MODEL_ID,
      elapsedMs,
      totalBytesRead,
      staging: pending.staging,
      mismatches,
      regions,
      regionGroups: DM32_VERIFY_REGION_GROUPS,
    });
  },

  formatDebugMarkdown(result: WriteVerifyResult, context: WriteVerifyDebugContext): string {
    return formatWriteVerifyDebugMarkdown(result, context, [
      'DM-32UV verify compares post-remap 4 KB blocks transmitted during upload.',
      'Contact bank blocks are excluded unless they were part of the upload staging set.',
    ]);
  },
};
