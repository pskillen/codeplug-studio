import { UV5R_MINI_LAYOUT } from '@integrations/radio-io/radios/uv17pro-family/layout.ts';
import { uv17ProBackupMemSpans } from '@integrations/radio-io/radios/uv17pro-family/backupRestoreRoles.ts';
import { describe, expect, it } from 'vitest';
import {
  packRadioBackupZip,
  type RadioBackupManifestV1,
} from '@integrations/radio-io/backup/index.ts';
import { archiveGaps, openDebugArchive, uv5rMiniArchiveDetails } from './captureArchive.ts';

const manifest: RadioBackupManifestV1 = {
  format: 'codeplug-studio-radio-backup',
  version: 1,
  capturedAt: '2026-01-01T00:00:00Z',
  capturedVia: 'web-serial',
  app: { buildEnv: 'test', buildVersion: 'test' },
  radioModelId: 'AT-D890UV',
  descriptorLabel: 'test',
  coverage: 'partial',
  imageByteLength: 20,
  regions: [
    {
      id: 'a',
      label: 'A',
      address: 2,
      byteLength: 2,
      path: 'regions/a.bin',
      restoreRole: 'restorable',
    },
    {
      id: 'b',
      label: 'B',
      address: 8,
      byteLength: 1,
      path: 'regions/b.bin',
      restoreRole: 'inspect-only',
    },
  ],
};

describe('debug archive', () => {
  it('preserves sparse regions, sidecars and original archive', () => {
    const bytes = packRadioBackupZip(
      manifest,
      { a: new Uint8Array([0, 7]), b: new Uint8Array([9]) },
      { 'calibration.json': new Uint8Array([3]) },
    );
    const archive = openDebugArchive(bytes, 'AT-D890UV');
    expect(archive.regions.a).toEqual(new Uint8Array([0, 7]));
    expect(archive.sidecars['calibration.json']).toEqual(new Uint8Array([3]));
    expect(archive.zipBytes).toEqual(bytes);
    expect(archiveGaps(archive.manifest.regions)).toEqual([{ start: 4, end: 7 }]);
  });
  it('rejects mismatched and corrupt archives', () => {
    const bytes = packRadioBackupZip(manifest, { a: new Uint8Array(2), b: new Uint8Array(1) });
    expect(() => openDebugArchive(bytes, 'DM-32UV')).toThrow(/does not match/);
    expect(() => openDebugArchive(new Uint8Array([1, 2]), 'AT-D890UV')).toThrow();
  });
});

it('maps partial Mini MEM bytes by radio address, keeping zones separate and calibration missing', () => {
  const mem = uv17ProBackupMemSpans(UV5R_MINI_LAYOUT)[2]!;
  const mini = {
    ...manifest,
    radioModelId: 'UV-5R Mini',
    regions: [
      {
        id: 'mem-2',
        label: 'MEM 3',
        address: mem.packedOffset,
        byteLength: 0x40,
        path: 'regions/mem.bin',
        restoreRole: 'restorable' as const,
      },
      {
        id: 'zones',
        label: 'Zones',
        address: 0xc000,
        byteLength: 0x40,
        path: 'regions/zones.bin',
        restoreRole: 'inspect-only' as const,
      },
    ],
  };
  const archive = openDebugArchive(
    packRadioBackupZip(mini, { 'mem-2': new Uint8Array(0x40), zones: new Uint8Array(0x40) }),
    'UV-5R Mini',
  );
  const ranges = uv5rMiniArchiveDetails(archive)!.coverage;
  expect(ranges).toContainEqual({
    label: 'Extras',
    start: mem.radioAddr,
    end: mem.radioAddr + 0x3f,
    captured: true,
  });
  expect(ranges).toContainEqual({
    label: 'MM9PDY data',
    start: 0xc000,
    end: 0xc03f,
    captured: true,
  });
  expect(ranges).toContainEqual({
    label: 'Calibration',
    start: 0xf000,
    end: 0xffff,
    captured: false,
  });
});
