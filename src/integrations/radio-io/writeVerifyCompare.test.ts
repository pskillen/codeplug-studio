import { describe, expect, it } from 'vitest';
import { createMemoryMap } from './kit/memoryMap.ts';
import {
  buildWriteVerifyResult,
  captureWriteVerifyStaging,
  compareStagingAgainstLookup,
  memoryMapByteLookup,
  regionAtFromManifest,
  sparseBlockByteLookup,
  summarizeEraseUnitCommitVerdicts,
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

    const regions = summarizeWriteVerifyRegions(staging, mismatches, MANIFEST, () => 0x10);
    expect(regions.find((r) => r.id === 'channels')?.status).toBe('mismatch');
    expect(regions.find((r) => r.id === 'channels')?.mismatchedChunks).toBe(1);
    expect(regions.find((r) => r.id === 'channels')?.notReadChunks).toBe(0);

    const result = buildWriteVerifyResult({
      model: 'test',
      elapsedMs: 1,
      totalBytesRead: 4,
      staging,
      mismatches,
      regions,
      regionGroups: [{ id: 'memories', label: 'Memories' }],
    });
    expect(result.ok).toBe(false);
    expect(result.staging.mismatchedChunks).toBe(1);
    expect(result.staging.notReadChunks).toBe(1);

    const unreadStaging = captureWriteVerifyStaging([
      { address: 0x120, data: new Uint8Array([0x01, 0x02]) },
    ]);
    const unreadRegions = summarizeWriteVerifyRegions(
      unreadStaging,
      [
        {
          kind: 'not_read',
          address: 0x120,
          regionId: 'settings',
          regionLabel: 'Settings',
          expected: new Uint8Array([0x01, 0x02]),
          actual: null,
        },
      ],
      MANIFEST,
      () => 0x40,
    );
    expect(unreadRegions.find((r) => r.id === 'settings')?.status).toBe('not_read');
    expect(unreadRegions.find((r) => r.id === 'settings')?.notReadChunks).toBe(1);
    expect(unreadRegions.find((r) => r.id === 'settings')?.mismatchedChunks).toBe(0);
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

  it('summarizeEraseUnitCommitVerdicts detects not-committed units', () => {
    const unitBase = 0x2f0_0000;
    const addr = unitBase + 0x100;
    const preWrite = new Uint8Array(16).fill(0xff);
    const staged = new Uint8Array(16).fill(0xab);
    const postRead = new Uint8Array(16).fill(0xff);

    const rows = summarizeEraseUnitCommitVerdicts({
      stagingChunks: [{ address: addr, data: staged }],
      preWriteByAddress: new Map([[addr, preWrite]]),
      lookup: {
        get(a: number, len: number) {
          if (a === addr && len === 16) return postRead;
          return null;
        },
      },
      unitBaseFor: (a) => a & ~0x3ffff,
      isComparableAddress: () => true,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      unitBase,
      stagedChunks: 1,
      mustChangeChunks: 1,
      changedChunks: 0,
      verdict: 'not-committed',
    });

    const okResult = buildWriteVerifyResult({
      model: 'test',
      elapsedMs: 1,
      totalBytesRead: 16,
      staging: captureWriteVerifyStaging([{ address: addr, data: staged }]),
      mismatches: [],
      regions: [],
      regionGroups: [],
      eraseUnits: rows,
    });
    expect(okResult.ok).toBe(false);
  });

  it('summarizeEraseUnitCommitVerdicts labels committed and no-evidence units', () => {
    const addr = 0x100;
    const unchanged = new Uint8Array(16).fill(0x55);
    const preWrite = new Uint8Array(16).fill(0xff);
    const staged = new Uint8Array(16).fill(0xab);
    const committedPost = new Uint8Array(16).fill(0xab);

    const noEvidence = summarizeEraseUnitCommitVerdicts({
      stagingChunks: [{ address: addr, data: unchanged }],
      preWriteByAddress: new Map([[addr, unchanged]]),
      lookup: {
        get(a: number, len: number) {
          if (a === addr && len === 16) return unchanged;
          return null;
        },
      },
      unitBaseFor: () => 0,
      isComparableAddress: () => true,
    });
    expect(noEvidence[0]?.verdict).toBe('no-evidence');
    expect(noEvidence[0]?.mustChangeChunks).toBe(0);

    const committed = summarizeEraseUnitCommitVerdicts({
      stagingChunks: [{ address: addr + 0x10, data: staged }],
      preWriteByAddress: new Map([[addr + 0x10, preWrite]]),
      lookup: {
        get(a: number, len: number) {
          if (a === addr + 0x10 && len === 16) return committedPost;
          return null;
        },
      },
      unitBaseFor: () => 0,
      isComparableAddress: () => true,
    });
    expect(committed[0]?.verdict).toBe('committed');
    expect(committed[0]?.mustChangeChunks).toBe(1);
    expect(committed[0]?.changedChunks).toBe(1);
  });

  it('summarizeEraseUnitCommitVerdicts labels partial when only some must-change bytes landed', () => {
    const addr = 0x100;
    const preWrite = new Uint8Array(16).fill(0xff);
    const stagedA = new Uint8Array(16).fill(0xaa);
    const stagedB = new Uint8Array(16).fill(0xbb);
    const postA = new Uint8Array(16).fill(0xaa);
    const postB = new Uint8Array(16).fill(0xff);

    const rows = summarizeEraseUnitCommitVerdicts({
      stagingChunks: [
        { address: addr, data: stagedA },
        { address: addr + 0x10, data: stagedB },
      ],
      preWriteByAddress: new Map([
        [addr, preWrite],
        [addr + 0x10, preWrite],
      ]),
      lookup: {
        get(a: number, len: number) {
          if (a === addr && len === 16) return postA;
          if (a === addr + 0x10 && len === 16) return postB;
          return null;
        },
      },
      unitBaseFor: () => 0,
      isComparableAddress: () => true,
    });

    expect(rows[0]?.verdict).toBe('partial');
    expect(rows[0]?.mustChangeChunks).toBe(2);
    expect(rows[0]?.changedChunks).toBe(1);

    const okResult = buildWriteVerifyResult({
      model: 'test',
      elapsedMs: 1,
      totalBytesRead: 32,
      staging: captureWriteVerifyStaging([
        { address: addr, data: stagedA },
        { address: addr + 0x10, data: stagedB },
      ]),
      mismatches: [],
      regions: [],
      regionGroups: [],
      eraseUnits: rows,
    });
    expect(okResult.ok).toBe(false);
  });
});
