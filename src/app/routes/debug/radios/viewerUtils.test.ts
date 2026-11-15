import { describe, expect, it } from 'vitest';
import {
  packRadioBackupZip,
  type RadioBackupManifestV1,
} from '@integrations/radio-io/backup/index.ts';
import { openDebugArchive } from './captureArchive.ts';
import { compareRegions, hexRows } from './viewerUtils.ts';

const manifest: RadioBackupManifestV1 = {
  format: 'codeplug-studio-radio-backup',
  version: 1,
  capturedAt: '2026-01-01',
  capturedVia: 'file',
  app: { buildEnv: 'test', buildVersion: 'test' },
  radioModelId: 'retevis-rt95',
  descriptorLabel: 'test',
  coverage: 'partial',
  imageByteLength: 2,
  regions: [
    {
      id: 'programming-image',
      label: 'A',
      address: 32,
      byteLength: 2,
      path: 'regions/a.bin',
      restoreRole: 'inspect-only',
    },
  ],
};
function capture(bytes: number[], address = 32) {
  const m = {
    ...manifest,
    regions: [{ ...manifest.regions[0], address, byteLength: bytes.length }],
  };
  return openDebugArchive(
    packRadioBackupZip(m, { 'programming-image': new Uint8Array(bytes) }),
    'retevis-rt95',
  );
}
describe('archive viewers', () => {
  it('bounds hex pages and keeps addresses within a region', () => {
    const rows = hexRows(new Uint8Array(1024 * 1024).fill(65), 32, 1);
    expect(rows).toHaveLength(16);
    expect(rows[0]).toMatchObject({ address: 288, ascii: 'AAAAAAAAAAAAAAAA' });
    expect(hexRows(new Uint8Array(1), 32, 1)).toEqual([]);
  });
  it('distinguishes changed bytes from missing bytes and incomparable offsets', () => {
    expect(compareRegions(capture([1, 2, 3]), capture([1, 4])).regions[0]).toMatchObject({
      comparable: true,
      changed: 1,
      missing: 1,
    });
    expect(compareRegions(capture([1]), capture([1], 33)).regions[0].comparable).toBe(false);
  });
  it('refuses unknown address spaces and representations', () => {
    const a = capture([1]);
    const unknown = {
      ...a,
      manifest: { ...a.manifest, regions: [{ ...a.manifest.regions[0], id: 'unknown' }] },
      regions: { unknown: new Uint8Array([1]) },
    };
    expect(compareRegions(unknown, unknown).regions[0]).toMatchObject({
      comparable: false,
      reason: expect.stringMatching(/unknown/),
    });
  });
  it('rejects different models', () => {
    const a = capture([1]);
    const b = { ...a, manifest: { ...a.manifest, radioModelId: 'different' } };
    expect(compareRegions(a, b).error).toMatch(/incompatible/);
  });
});
