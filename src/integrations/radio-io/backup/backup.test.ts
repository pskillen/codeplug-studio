import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import {
  RADIO_BACKUP_FORMAT,
  RadioBackupError,
  packRadioBackupZip,
  parseRadioBackupZip,
  validateRadioBackupManifest,
  type RadioBackupManifestV1,
} from './index.ts';

function filled(length: number, value: number): Uint8Array {
  return Uint8Array.from({ length }, () => value);
}

function d890LikeManifest(): RadioBackupManifestV1 {
  return {
    format: RADIO_BACKUP_FORMAT,
    version: 1,
    capturedAt: '2026-08-13T11:00:00.000Z',
    capturedVia: 'web-serial',
    app: { buildEnv: 'test', buildVersion: '0.0.0-test' },
    radioModelId: 'at-d890uv',
    descriptorLabel: 'Anytone AT-D890UV',
    firmware: 'D890V1.23',
    serial: 'SN890TEST',
    coverage: 'known-map-regions',
    imageByteLength: 0x0200_0000,
    regions: [
      {
        id: 'channels',
        label: 'Channels',
        address: 0x0200_0000,
        byteLength: 64,
        path: 'regions/channels.bin',
        restoreRole: 'restorable',
      },
      {
        id: 'zones',
        label: 'Zones',
        address: 0x0300_0000,
        byteLength: 32,
        path: 'regions/zones.bin',
        restoreRole: 'restorable',
      },
      {
        id: 'local-info',
        label: 'LocalInfo',
        address: 0x0400_0000,
        byteLength: 16,
        path: 'regions/local-info.bin',
        restoreRole: 'inspect-only',
      },
      {
        id: 'calibration',
        label: 'Calibration',
        address: 0x0500_0000,
        byteLength: 8,
        path: 'regions/calibration.bin',
        restoreRole: 'inspect-only',
      },
    ],
  };
}

function d890LikeBytes(): Record<string, Uint8Array> {
  return {
    channels: filled(64, 0xa1),
    zones: filled(32, 0xa2),
    'local-info': filled(16, 0xa3),
    calibration: filled(8, 0xa4),
  };
}

function uv5rLikeManifest(): RadioBackupManifestV1 {
  return {
    format: RADIO_BACKUP_FORMAT,
    version: 1,
    capturedAt: '2026-08-13T12:00:00.000Z',
    capturedVia: 'file',
    app: { buildEnv: 'test', buildVersion: '0.0.0-test' },
    radioModelId: 'uv-5r-mini',
    descriptorLabel: 'Baofeng UV-5R Mini',
    coverage: 'full-clone',
    imageByteLength: 0x2000,
    regions: [
      {
        id: 'channels',
        label: 'Channels',
        address: 0,
        byteLength: 0x1000,
        path: 'regions/channels.bin',
        restoreRole: 'restorable',
      },
      {
        id: 'settings',
        label: 'Settings',
        address: 0x1000,
        byteLength: 0x800,
        path: 'regions/settings.bin',
        restoreRole: 'restorable',
      },
      {
        id: 'vfo',
        label: 'VFO',
        address: 0x1800,
        byteLength: 0x800,
        path: 'regions/vfo.bin',
        restoreRole: 'restorable',
      },
    ],
  };
}

function dm32LikeManifest(): RadioBackupManifestV1 {
  return {
    format: RADIO_BACKUP_FORMAT,
    version: 1,
    capturedAt: '2026-08-13T13:00:00.000Z',
    capturedVia: 'web-serial',
    app: { buildEnv: 'test', buildVersion: '0.0.0-test' },
    radioModelId: 'dm-32uv',
    descriptorLabel: 'Baofeng DM-32UV',
    firmware: '2.00',
    coverage: 'known-map-regions',
    imageByteLength: 0x10_0000,
    restoreFragileAfterFactoryReset: true,
    addressBase: 0x02e0_0000,
    dm32ContactsBase: 0x03a0_0000,
    dm32ContactsEnd: 0x03b0_0000,
    regions: [
      {
        id: 'channels',
        label: 'Channels',
        address: 0x02e0_0000,
        byteLength: 48,
        path: 'regions/channels.bin',
        restoreRole: 'restorable',
      },
      {
        id: 'calibration',
        label: 'Calibration',
        address: 0x7f00,
        byteLength: 24,
        path: 'regions/calibration.bin',
        restoreRole: 'inspect-only',
      },
    ],
  };
}

describe('radio-backup zip', () => {
  it('round-trips a D890-like sparse known-map archive with inspect-only regions', () => {
    const manifest = d890LikeManifest();
    const regionBytes = d890LikeBytes();
    const zip = packRadioBackupZip(manifest, regionBytes);
    const parsed = parseRadioBackupZip(zip);

    expect(parsed.manifest).toEqual(manifest);
    expect(parsed.manifest.coverage).toBe('known-map-regions');
    expect(parsed.manifest.serial).toBe('SN890TEST');
    expect(parsed.manifest.regions.map((r) => r.restoreRole)).toEqual([
      'restorable',
      'restorable',
      'inspect-only',
      'inspect-only',
    ]);
    expect(parsed.regions.channels).toEqual(regionBytes.channels);
    expect(parsed.regions['local-info']).toEqual(regionBytes['local-info']);
    expect(parsed.regions.calibration).toEqual(regionBytes.calibration);
  });

  it('round-trips a UV-5R-like three-region full-clone archive without serial', () => {
    const manifest = uv5rLikeManifest();
    const regionBytes = {
      channels: filled(0x1000, 0xb1),
      settings: filled(0x800, 0xb2),
      vfo: filled(0x800, 0xb3),
    };
    const parsed = parseRadioBackupZip(packRadioBackupZip(manifest, regionBytes));

    expect(parsed.manifest).toEqual(manifest);
    expect(parsed.manifest.serial).toBeUndefined();
    expect(parsed.manifest.coverage).toBe('full-clone');
    expect(parsed.manifest.regions).toHaveLength(3);
    expect(parsed.regions.vfo).toEqual(regionBytes.vfo);
  });

  it('round-trips DM-32 factory-reset-fragile bases', () => {
    const manifest = dm32LikeManifest();
    const regionBytes = {
      channels: filled(48, 0xc1),
      calibration: filled(24, 0xc2),
    };
    const parsed = parseRadioBackupZip(packRadioBackupZip(manifest, regionBytes));

    expect(parsed.manifest.restoreFragileAfterFactoryReset).toBe(true);
    expect(parsed.manifest.addressBase).toBe(0x02e0_0000);
    expect(parsed.manifest.dm32ContactsBase).toBe(0x03a0_0000);
    expect(parsed.manifest.dm32ContactsEnd).toBe(0x03b0_0000);
    expect(parsed.regions.channels).toEqual(regionBytes.channels);
  });

  it('rejects a zip with no manifest.json', () => {
    const zip = zipSync({ 'regions/channels.bin': filled(4, 1) });
    expect(() => parseRadioBackupZip(zip)).toThrow(RadioBackupError);
    expect(() => parseRadioBackupZip(zip)).toThrow(/missing manifest\.json/);
  });

  it('rejects wrong format and unknown version', () => {
    expect(() => validateRadioBackupManifest({ ...d890LikeManifest(), format: 'radio-info' })).toThrow(
      /format must be/,
    );
    expect(() => validateRadioBackupManifest({ ...d890LikeManifest(), version: 2 })).toThrow(
      /version must be 1/,
    );
  });

  it('rejects a truncated region bin', () => {
    const manifest = d890LikeManifest();
    const zip = zipSync({
      'manifest.json': strToU8(`${JSON.stringify(manifest, null, 2)}\n`),
      'regions/channels.bin': filled(64, 0xa1),
      'regions/zones.bin': filled(32, 0xa2),
      'regions/local-info.bin': filled(16, 0xa3),
      'regions/calibration.bin': filled(7, 0xa4),
    });
    expect(() => parseRadioBackupZip(zip)).toThrow(RadioBackupError);
    expect(() => parseRadioBackupZip(zip)).toThrow(/calibration is 7 bytes, expected 8/);
  });

  it('rejects a region path that is not under regions/', () => {
    const manifest = d890LikeManifest();
    manifest.regions[0] = { ...manifest.regions[0]!, path: '../channels.bin' };
    expect(() => validateRadioBackupManifest(manifest)).toThrow(/must be under regions\//);
  });

  it('rejects invalid JSON in manifest.json', () => {
    const zip = zipSync({ 'manifest.json': strToU8('{not-json') });
    expect(() => parseRadioBackupZip(zip)).toThrow(/not valid JSON/);
  });
});
