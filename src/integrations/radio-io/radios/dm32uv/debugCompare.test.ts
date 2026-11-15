import { describe, expect, it } from 'vitest';
import type { RadioBackupManifestV1 } from '../../backup/types.ts';
import { compareDm32Evidence, type Dm32CompareArchive } from './debugCompare.ts';
import {
  DM32_BLOCK_SIZE,
  DM32_FACTORY_SECTOR_ADDRESS,
  DM32_FACTORY_SECTOR_LENGTH,
  DM32_METADATA_OFFSET,
} from './constants.ts';
import { DM32_FACTORY_SECTOR_REGION_ID } from './calibrationDecode.ts';

function capture(page?: Uint8Array): Dm32CompareArchive {
  const manifest: RadioBackupManifestV1 = {
    format: 'codeplug-studio-radio-backup',
    version: 1,
    capturedAt: '2026-01-01T00:00:00Z',
    capturedVia: 'web-serial',
    app: { buildEnv: 'test', buildVersion: 'test' },
    radioModelId: 'DM-32UV',
    descriptorLabel: 'test',
    coverage: 'partial',
    addressBase: 0,
    imageByteLength: DM32_BLOCK_SIZE,
    regions: page
      ? [
          {
            id: 'config',
            label: 'Config',
            address: 0,
            byteLength: page.length,
            path: 'regions/config.bin',
            restoreRole: 'inspect-only',
          },
        ]
      : [],
  };
  return { manifest, regions: page ? { config: page } : {}, sidecars: {} };
}

describe('DM-32 decoded comparison', () => {
  it('decodes captured pages, reports changes and invalid BCD as unavailable', () => {
    const a = new Uint8Array(DM32_BLOCK_SIZE);
    a[DM32_METADATA_OFFSET] = 2;
    const b = a.slice();
    b[0x40] = 7;
    b[0] = 0xff;
    const rows = compareDm32Evidence(capture(a), capture(b));
    expect(rows.find((r) => r.field === 'Calibration / uhfPower / low / 0')?.status).toBe(
      'Changed',
    );
    expect(rows.find((r) => r.field === 'Calibration / uhfBand / lowHz')?.status).toBe(
      'Unavailable',
    );
    expect(rows.find((r) => r.field === 'Calibration / uhfPower / low / 1')?.status).toBe(
      'Unchanged',
    );
  });
  it('does not report absent pages or factory sectors as unchanged', () => {
    const rows = compareDm32Evidence(capture(), capture());
    expect(rows.find((r) => r.field === 'Calibration')?.status).toBe('Unavailable');
    expect(rows.find((r) => r.field === 'Factory')?.status).toBe('Unavailable');
  });
});

function calPage(fill = 0): Uint8Array {
  const page = new Uint8Array(DM32_BLOCK_SIZE).fill(fill);
  page[DM32_METADATA_OFFSET] = 2;
  return page;
}
const factoryRegion = (
  address = DM32_FACTORY_SECTOR_ADDRESS,
  byteLength = DM32_FACTORY_SECTOR_LENGTH,
) => ({
  id: DM32_FACTORY_SECTOR_REGION_ID,
  label: 'Factory',
  address,
  byteLength,
  path: 'regions/factory-sector.bin',
  restoreRole: 'inspect-only' as const,
});
function withFactory(
  base: Dm32CompareArchive,
  bytes: Uint8Array,
  region = factoryRegion(),
): Dm32CompareArchive {
  return {
    ...base,
    manifest: { ...base.manifest, regions: [...base.manifest.regions, region] },
    regions: { ...base.regions, [DM32_FACTORY_SECTOR_REGION_ID]: bytes },
  };
}
const status = (rows: ReturnType<typeof compareDm32Evidence>, field: string) =>
  rows.find((r) => r.field === field)?.status;

describe('DM-32 decoded comparison, factory and sparse cases', () => {
  it('compares the factory sector in its own space and never uses the anti-clone bytes', () => {
    const a = new Uint8Array(DM32_FACTORY_SECTOR_LENGTH);
    const b = a.slice();
    b[0x80] = 0x04;
    b[0x10c] = 0x99;
    const same = compareDm32Evidence(withFactory(capture(), a), withFactory(capture(), a.slice()));
    expect(status(same, 'Factory / gpsEnabled')).toBe('Unchanged');
    const diff = compareDm32Evidence(withFactory(capture(), a), withFactory(capture(), b));
    expect(status(diff, 'Factory / gpsEnabled')).toBe('Changed');
    expect(diff.some((r) => /antiClone/i.test(r.field))).toBe(false);
    expect(JSON.stringify(diff)).not.toContain('99');
  });
  it('treats a factory sector on one side only as unavailable', () => {
    const rows = compareDm32Evidence(
      withFactory(capture(), new Uint8Array(DM32_FACTORY_SECTOR_LENGTH)),
      capture(),
    );
    expect(status(rows, 'Factory / gpsEnabled')).toBe('Unavailable');
    expect(status(rows, 'Factory')).toBe('Unavailable');
  });
  it('never reads factory bytes as configuration or the reverse', () => {
    const sector = new Uint8Array(DM32_FACTORY_SECTOR_LENGTH);
    sector[DM32_METADATA_OFFSET] = 2;
    // Factory-id entry at a configuration address, and a config entry at the factory address.
    const misplaced = withFactory(capture(), sector, factoryRegion(0, DM32_FACTORY_SECTOR_LENGTH));
    const rows = compareDm32Evidence(misplaced, misplaced);
    expect(status(rows, 'Factory')).toBe('Unavailable');
    expect(rows.some((r) => r.field.startsWith('Factory /'))).toBe(false);
    const high = capture(calPage());
    high.manifest.regions[0]!.address = DM32_FACTORY_SECTOR_ADDRESS;
    const out = compareDm32Evidence(high, high);
    expect(status(out, 'Calibration')).toBe('Unavailable');
  });
  it('keeps unknown, overlapping, malformed and out-of-window regions incomparable', () => {
    const base = capture(calPage());
    const overlap: Dm32CompareArchive = {
      ...base,
      manifest: {
        ...base.manifest,
        regions: [...base.manifest.regions, { ...base.manifest.regions[0]!, id: 'dup' }],
      },
      regions: { ...base.regions, dup: calPage() },
    };
    expect(status(compareDm32Evidence(overlap, overlap), 'Calibration')).toBe('Unavailable');
    const short = capture(calPage());
    short.manifest.regions[0]!.byteLength = DM32_BLOCK_SIZE * 2;
    expect(status(compareDm32Evidence(short, short), 'Calibration')).toBe('Unavailable');
    const outside = capture(calPage());
    outside.manifest.imageByteLength = 0;
    expect(status(compareDm32Evidence(outside, outside), 'Calibration')).toBe('Unavailable');
    const missingBytes = { ...capture(calPage()), regions: {} };
    expect(status(compareDm32Evidence(missingBytes, missingBytes), 'Calibration')).toBe(
      'Unavailable',
    );
  });
  it('reports a partition mismatch (calibration on one side only) as unavailable', () => {
    const rows = compareDm32Evidence(capture(calPage()), capture());
    expect(status(rows, 'Calibration / uhfPower / low / 0')).toBe('Unavailable');
    expect(rows.some((r) => r.status === 'Unchanged' && r.field.startsWith('Calibration'))).toBe(
      false,
    );
  });
  it('does not call a different page address a decoded change', () => {
    const a = capture(calPage());
    const b = capture(calPage());
    const rows = compareDm32Evidence(a, b);
    expect(rows.some((r) => r.field.endsWith('/ address'))).toBe(false);
  });
});
