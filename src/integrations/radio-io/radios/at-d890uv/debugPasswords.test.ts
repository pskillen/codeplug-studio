import { describe, expect, it } from 'vitest';
import {
  RADIO_BACKUP_FORMAT,
  RADIO_BACKUP_VERSION,
  type RadioBackupManifestV1,
} from '../../backup/types.ts';
import type { DebugSensitiveArchive } from '../../debugSensitive.ts';
import { D890_MAP } from './constants.ts';
import { atD890ArchiveSensitiveRanges } from './debugPasswords.ts';

function archive(regionId: string, address: number, length: number): DebugSensitiveArchive {
  const manifest: RadioBackupManifestV1 = {
    format: RADIO_BACKUP_FORMAT,
    version: RADIO_BACKUP_VERSION,
    capturedAt: '2026-11-24T00:00:00.000Z',
    capturedVia: 'web-serial',
    app: { buildEnv: 'test', buildVersion: '0' },
    radioModelId: 'AT-D890UV',
    descriptorLabel: 'Anytone AT-D890UV',
    coverage: 'known-map-regions',
    imageByteLength: 0x500_0000,
    regions: [
      {
        id: regionId,
        label: regionId,
        address,
        byteLength: length,
        path: `regions/${regionId}.bin`,
        restoreRole: 'restorable',
      },
    ],
  };
  return {
    manifest,
    regions: { [regionId]: new Uint8Array(length) },
    sidecars: {},
  };
}

describe('atD890ArchiveSensitiveRanges', () => {
  it('returns the AirSecurity seed range for a settings-store region', () => {
    expect(
      atD890ArchiveSensitiveRanges(
        archive('settings-store', D890_MAP.SettingsStore, D890_MAP.SettingsStoreLength),
        'settings-store',
      ),
    ).toEqual([
      {
        start: 0x03500220,
        end: 0x03500240,
        label: 'Brandmeister AirSecurity seed',
      },
    ]);
  });
});
