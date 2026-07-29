import { describe, expect, it } from 'vitest';
import { createMemoryMap } from './kit/memoryMap.ts';
import {
  buildWriteVerifyResult,
  captureWriteVerifyStaging,
  compareStagingAgainstLookup,
  memoryMapByteLookup,
  regionAtFromManifest,
  sparseBlockByteLookup,
  summarizeWriteVerifyRegions,
} from './writeVerifyCompare.ts';

const MANIFEST = [
  { id: 'channels', label: 'Channels', group: 'memories', start: 0x0000, length: 0x100 },
  { id: 'settings', label: 'Settings', group: 'radio', start: 0x100, length: 0x40 },
] as const;

describe('writeVerifyCompare', () => {
  it('reports match when staged bytes equal read image', () => {
    const map = createMemoryMap(0x200);
    map.set(0x0000, new Uint8Array([1, 2, 3, 4]));
    map.set(0x0010, new Uint8Array([0xaa, 0xbb]));

    const staging = captureWriteVerifyStaging([
      { address: 0x0000, data: new Uint8Array([1, 2, 3, 4]) },
      { address: 0x0010, data: new Uint8Array([0xaa, 0xbb]) },
    ]);

    const mismatches = compareStagingAgainstLookup(staging, memoryMapByteLookup(map), (addr) =>
      regionAtFromManifest(MANIFEST, addr),
    );

    expect(mismatches).toHaveLength(0);
    const regions = summarizeWriteVerifyRegions(staging, mismatches, MANIFEST, (id) =>
      id === 'channels' ? 0x20 : 0,
    );
    expect(regions.find((r) => r.id === 'channels')?.status).toBe('match');
    expect(regions.find((r) => r.id === 'settings')?.status).toBe('skipped');
  });

  it('reports mismatch and not_read without fabricating bytes', () => {
    const map = createMemoryMap(0x200);
    map.set(0x0000, new Uint8Array([9, 9, 9, 9]));

    const staging = captureWriteVerifyStaging([
      { address: 0x0000, data: new Uint8Array([1, 2, 3, 4]) },
      { address: 0x300, data: new Uint8Array([0x01, 0x02]) },
    ]);

    const mismatches = compareStagingAgainstLookup(staging, memoryMapByteLookup(map), (addr) =>
      regionAtFromManifest(MANIFEST, addr),
    );

    expect(mismatches).toHaveLength(2);
    expect(mismatches[0]?.kind).toBe('mismatch');
    expect(mismatches[1]?.kind).toBe('not_read');
    expect(mismatches[1]?.actual).toBeNull();

    const result = buildWriteVerifyResult({
      model: 'test',
      elapsedMs: 1,
      totalBytesRead: 4,
      staging,
      mismatches,
      regions: summarizeWriteVerifyRegions(staging, mismatches, MANIFEST, () => 0x10),
      regionGroups: [{ id: 'memories', label: 'Memories' }],
    });
    expect(result.ok).toBe(false);
    expect(result.staging.mismatchedChunks).toBe(1);
    expect(result.staging.notReadChunks).toBe(1);
  });

  it('compares sparse block lookup by absolute address', () => {
    const blocks = new Map<number, Uint8Array>([[0x4000, new Uint8Array(16).fill(0x55)]]);
    const staging = captureWriteVerifyStaging([
      { address: 0x4000, data: new Uint8Array(16).fill(0x55) },
    ]);
    const mismatches = compareStagingAgainstLookup(staging, sparseBlockByteLookup(blocks), () => ({
      id: 'block',
      label: 'Block',
    }));
    expect(mismatches).toHaveLength(0);
  });

  it('maps staged addresses through offset translator', () => {
    const map = createMemoryMap(0x100);
    map.set(0x10, new Uint8Array([0xde, 0xad]));
    const staging = captureWriteVerifyStaging([
      { address: 0x9000, data: new Uint8Array([0xde, 0xad]) },
    ]);
    const mismatches = compareStagingAgainstLookup(
      staging,
      memoryMapByteLookup(map, (addr) => addr - 0x8ff0),
      () => ({ id: 'packed', label: 'Packed' }),
    );
    expect(mismatches).toHaveLength(0);
  });
});
