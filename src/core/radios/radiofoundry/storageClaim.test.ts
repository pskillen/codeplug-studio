import { describe, expect, it } from 'vitest';
import {
  assertSaneStorageClaimRanges,
  storageClaimBinFileName,
  storageClaimRangesFromInfo,
  storageClaimReadChunks,
  StorageClaimRulesError,
} from './storageClaim.ts';

describe('storage claim product rules', () => {
  const foreign = {
    region: 'foreign' as const,
    claimPending: false,
    settings: { address: 0x011000, size: 0x8000 },
    journal: { address: 0x019000, size: 0x2000 },
    calibration: { address: 0x010000, size: 0x200 },
  };

  it('lists every non-zero range', () => {
    expect(storageClaimRangesFromInfo(foreign).map((r) => r.kind)).toEqual([
      'settings',
      'journal',
      'calibration',
    ]);
  });

  it('read chunks stay within 1000 bytes', () => {
    const chunks = storageClaimReadChunks(32768);
    expect(chunks.every((n) => n <= 1000)).toBe(true);
    expect(chunks.reduce((a, b) => a + b, 0)).toBe(32768);
  });

  it('refuses sane-range violations', () => {
    expect(() =>
      assertSaneStorageClaimRanges([{ kind: 'journal', address: 0x1000, size: 0x1000 }]),
    ).toThrow(StorageClaimRulesError);
    expect(() =>
      assertSaneStorageClaimRanges([
        { kind: 'settings', address: 0, size: 1000 },
        { kind: 'journal', address: 500, size: 0x2000 },
      ]),
    ).toThrow(StorageClaimRulesError);
  });

  it('names backup files with full token hex', () => {
    const d = new Date('2026-11-24T15:04:05');
    expect(storageClaimBinFileName(0x12345678, d, 'settings', 0x011000)).toBe(
      'storage_12345678_20261124-150405_settings_011000.bin',
    );
  });
});
