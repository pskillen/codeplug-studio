import {
  packRadioBackupZip,
  type RadioBackupManifestV1,
} from '@integrations/radio-io/backup/index.ts';
import { openDebugArchive } from './captureArchive.ts';

export function exampleArchive(capturedAt = '2026-01-01T00:00:00Z') {
  const manifest: RadioBackupManifestV1 = {
    format: 'codeplug-studio-radio-backup',
    version: 1,
    capturedAt,
    capturedVia: 'web-serial',
    app: { buildEnv: 'test', buildVersion: 'test' },
    radioModelId: 'AT-D890UV',
    descriptorLabel: 'test',
    coverage: 'partial',
    imageByteLength: 2,
    regions: [
      {
        id: 'a',
        label: 'A',
        address: 0,
        byteLength: 2,
        path: 'regions/a.bin',
        restoreRole: 'inspect-only',
      },
    ],
  };
  const bytes = packRadioBackupZip(
    manifest,
    { a: new Uint8Array([1, 2]) },
    { 'debug/test.bin': new Uint8Array([3]) },
  );
  return { ...openDebugArchive(bytes, 'AT-D890UV'), source: 'live-read' as const };
}
