import { describe, expect, it } from 'vitest';
import { memoryMapFromBytes } from '../../kit/memoryMap.ts';
import {
  buildWriteVerifyResult,
  captureWriteVerifyStaging,
  compareStagingAgainstLookup,
  memoryMapByteLookup,
  regionAtFromManifest,
  summarizeWriteVerifyRegions,
} from '../../writeVerifyCompare.ts';
import { RT95_BLOCK_SIZE, RT95_IMAGE_SIZE } from './constants.ts';
import { buildSyntheticRt95Image } from './__fixtures__/syntheticImage.ts';
import { RT95_REGION_MANIFEST } from './writeRole.ts';

const MANIFEST = RT95_REGION_MANIFEST.map((r) => ({
  id: r.id,
  label: r.label,
  group: r.role,
  start: r.offset,
  length: r.length,
}));

describe('RT95 write verify compare', () => {
  it('matches staged clone blocks against identical read image', () => {
    const bytes = buildSyntheticRt95Image();
    const image = memoryMapFromBytes(bytes);
    const chunks: { address: number; data: Uint8Array }[] = [];
    for (let addr = 0; addr < RT95_IMAGE_SIZE; addr += RT95_BLOCK_SIZE) {
      if (addr > 0x3290) break;
      chunks.push({ address: addr, data: image.get(addr, RT95_BLOCK_SIZE) });
    }
    const staging = captureWriteVerifyStaging(chunks);
    const mismatches = compareStagingAgainstLookup(
      staging,
      memoryMapByteLookup(image),
      (addr) => regionAtFromManifest(MANIFEST, addr),
    );
    expect(mismatches).toHaveLength(0);
    const result = buildWriteVerifyResult({
      model: 'retevis-rt95',
      elapsedMs: 1,
      totalBytesRead: RT95_IMAGE_SIZE,
      staging,
      mismatches,
      regions: summarizeWriteVerifyRegions(staging, mismatches, MANIFEST, () => 0x10),
      regionGroups: [],
    });
    expect(result.ok).toBe(true);
  });

  it('detects a corrupted channel block', () => {
    const original = buildSyntheticRt95Image();
    const corrupted = original.slice();
    corrupted[4] = 0xff;
    const image = memoryMapFromBytes(corrupted);
    const staging = captureWriteVerifyStaging([
      { address: 0x0000, data: original.subarray(0, RT95_BLOCK_SIZE) },
    ]);
    const mismatches = compareStagingAgainstLookup(
      staging,
      memoryMapByteLookup(image),
      (addr) => regionAtFromManifest(MANIFEST, addr),
    );
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]?.kind).toBe('mismatch');
    expect(mismatches[0]?.regionId).toBe('channels');
  });
});
