import { describe, expect, it } from 'vitest';
import type { RadioBackupManifestV1 } from '../../backup/types.ts';
import { compareDm32Evidence, type Dm32CompareArchive } from './debugCompare.ts';
import { DM32_BLOCK_SIZE, DM32_METADATA_OFFSET } from './constants.ts';

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
