import { describe, expect, it } from 'vitest';
import {
  packRadioBackupZip,
  type RadioBackupManifestV1,
} from '@integrations/radio-io/backup/index.ts';
import { openDebugArchive } from './captureArchive.ts';
import { syntheticOpenGd77Archive } from './opengd77.fixture.ts';
import { archiveKey, compareRegions, hexRows, regionIdentity } from './viewerUtils.ts';

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
  it('marks a calibration region missing from either archive incomparable', () => {
    const old = capture([1, 2]);
    const region = {
      id: 'rt95-calibration',
      label: 'Calibration',
      address: 0x3b00,
      byteLength: 3,
      path: 'regions/rt95-calibration.bin',
      restoreRole: 'inspect-only' as const,
    };
    const newer = openDebugArchive(
      packRadioBackupZip(
        { ...old.manifest, regions: [...old.manifest.regions, region] },
        {
          'programming-image': new Uint8Array([1, 2]),
          'rt95-calibration': new Uint8Array([0, 2, 3]),
        },
      ),
      'retevis-rt95',
    );
    for (const [a, b] of [
      [old, newer],
      [newer, old],
    ] as const) {
      expect(compareRegions(a, b).regions.find((r) => r.id === region.id)).toMatchObject({
        comparable: false,
        missing: 3,
      });
    }
  });
  it('rejects different models', () => {
    const a = capture([1]);
    const b = { ...a, manifest: { ...a.manifest, radioModelId: 'different' } };
    expect(compareRegions(a, b).error).toMatch(/incompatible/);
  });
});

it('classifies DM-32 configuration separately and refuses overlapping or unknown regions', () => {
  const base = capture([1]);
  const region = {
    id: 'config',
    label: 'Config',
    address: 0,
    byteLength: 4096,
    path: 'regions/config.bin',
    restoreRole: 'inspect-only' as const,
  };
  const a = {
    ...base,
    manifest: {
      ...base.manifest,
      radioModelId: 'DM-32UV',
      addressBase: 0,
      imageByteLength: 4096,
      regions: [region],
    },
    regions: { config: new Uint8Array(4096) },
  };
  const b = { ...a, regions: { config: new Uint8Array(4096).fill(1) } };
  expect(compareRegions(a, b).regions[0]).toMatchObject({ comparable: true, changed: 4096 });
  const overlap = {
    ...a,
    manifest: { ...a.manifest, regions: [region, { ...region, id: 'other' }] },
    regions: { ...a.regions, other: new Uint8Array(4096) },
  };
  expect(compareRegions(overlap, overlap).regions.every((r) => !r.comparable)).toBe(true);
  const outside = { ...a, manifest: { ...a.manifest, regions: [{ ...region, address: 4096 }] } };
  expect(compareRegions(outside, outside).regions[0].comparable).toBe(false);
});

describe('DM-32 sparse and factory comparison', () => {
  const entry = (id: string, address: number, byteLength: number) => ({
    id,
    label: id,
    address,
    byteLength,
    path: `regions/${id}.bin`,
    restoreRole: 'inspect-only' as const,
  });
  const make = (
    regions: ReturnType<typeof entry>[],
    bytes: Record<string, Uint8Array>,
    imageByteLength = 3 * 4096,
  ) => {
    const base = capture([1]);
    return {
      ...base,
      manifest: {
        ...base.manifest,
        radioModelId: 'DM-32UV',
        addressBase: 0,
        imageByteLength,
        regions,
      },
      regions: bytes,
    };
  };
  const factory = (fill: number) => ({
    entry: entry('factory-sector', 0x0300_b000, 4096),
    bytes: new Uint8Array(4096).fill(fill),
  });

  it('compares the factory sector as its own address space, not against configuration', () => {
    const a = make([factory(1).entry], { 'factory-sector': factory(1).bytes });
    const b = make([factory(2).entry], { 'factory-sector': factory(2).bytes });
    expect(regionIdentity(a, 'factory-sector')?.space).toBe('DM-32 factory sector');
    expect(compareRegions(a, b).regions[0]).toMatchObject({ comparable: true, changed: 4096 });
    // Same id but configuration address: never comparable with the real factory sector.
    const wrongSpace = make([entry('factory-sector', 0, 4096)], {
      'factory-sector': new Uint8Array(4096),
    });
    expect(regionIdentity(wrongSpace, 'factory-sector')).toBeUndefined();
    expect(compareRegions(a, wrongSpace).regions[0]?.comparable).toBe(false);
  });
  it('keeps differently partitioned sparse runs incomparable and flags partial coverage', () => {
    const page = new Uint8Array(4096);
    const a = make([entry('p0', 0, 4096), entry('p1', 4096, 4096)], { p0: page, p1: page });
    const b = make([entry('p0', 0, 8192)], { p0: new Uint8Array(8192) });
    const rows = compareRegions(a, b).regions;
    expect(rows.find((r) => r.id === 'p1')).toMatchObject({ comparable: false });
    expect(rows.find((r) => r.id === 'p0')).toMatchObject({ comparable: true, missing: 4096 });
    const moved = make([entry('p0', 4096, 4096)], { p0: page });
    expect(compareRegions(a, moved).regions.find((r) => r.id === 'p0')?.comparable).toBe(false);
  });
  it('does not classify a region whose bytes are missing or the wrong length', () => {
    const missing = make([entry('p0', 0, 4096)], {});
    expect(regionIdentity(missing, 'p0')).toBeUndefined();
    const short = make([entry('p0', 0, 4096)], { p0: new Uint8Array(10) });
    expect(regionIdentity(short, 'p0')).toBeUndefined();
    expect(regionIdentity(missing, 'nope')).toBeUndefined();
  });
});

describe('archiveKey', () => {
  it('is stable per archive object and differs between archives', () => {
    const a = capture([1, 2]);
    const b = { ...a };
    expect(archiveKey(a)).toBe(archiveKey(a));
    expect(archiveKey(b)).not.toBe(archiveKey(a));
  });
});

describe.each(['DM-1701', 'MD-9600'])('OpenGD77 %s regions', (modelId) => {
  it('compares flash spans and a packed User Database; unknown regions and models are refused', async () => {
    const a = await syntheticOpenGd77Archive(modelId);
    const b = await syntheticOpenGd77Archive(modelId, { userDatabaseEntries: 3 });
    expect(regionIdentity(a, 'flash-span-0')?.space).toBe('OpenGD77 FLASH, absolute address');
    expect(regionIdentity(a, 'bogus')).toBeUndefined();
    const result = compareRegions(a, b);
    expect(result.regions.find((r) => r.id === 'flash-span-0')).toMatchObject({
      comparable: true,
      changed: 0,
    });
    expect(result.regions.find((r) => r.id === 'user-database')).toMatchObject({
      comparable: true,
      changed: 1,
      missing: 27,
    });
    const other = await syntheticOpenGd77Archive(modelId === 'DM-1701' ? 'MD-9600' : 'DM-1701');
    expect(compareRegions(a, other).error).toMatch(/Radio models differ/);
  });
});
