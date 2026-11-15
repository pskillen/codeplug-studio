import { describe, expect, it } from 'vitest';
import {
  RADIO_BACKUP_FORMAT,
  RADIO_BACKUP_LABEL_MAX,
  RadioBackupError,
  normaliseBackupLabels,
  packRadioBackupZip,
  parseRadioBackupZip,
  relabelRadioBackupZip,
  validateRadioBackupManifest,
  type RadioBackupManifestV1,
} from './index.ts';

function manifest(extra: Partial<RadioBackupManifestV1> = {}): RadioBackupManifestV1 {
  return {
    format: RADIO_BACKUP_FORMAT,
    version: 1,
    capturedAt: '2026-08-13T11:00:00.000Z',
    capturedVia: 'web-serial',
    app: { buildEnv: 'test', buildVersion: '0.0.0-test' },
    radioModelId: 'model-a',
    descriptorLabel: 'Model A',
    coverage: 'partial',
    imageByteLength: 4,
    regions: [
      {
        id: 'r',
        label: 'R',
        address: 0,
        byteLength: 4,
        path: 'regions/r.bin',
        restoreRole: 'restorable',
      },
    ],
    ...extra,
  };
}

const bytes = Uint8Array.from([1, 2, 3, 4]);

describe('backup labels', () => {
  it('opens a backup with no label fields unchanged', () => {
    const parsed = parseRadioBackupZip(packRadioBackupZip(manifest(), { r: bytes }));
    expect(parsed.manifest.radioName).toBeUndefined();
    expect(parsed.manifest.label).toBeUndefined();
    expect(parsed.manifest.description).toBeUndefined();
  });

  it('round-trips the three fields through pack and parse', () => {
    const zip = packRadioBackupZip(
      manifest({ radioName: 'Radio 1', label: 'Before update', description: 'Spare handset' }),
      { r: bytes },
    );
    expect(parseRadioBackupZip(zip).manifest).toMatchObject({
      radioName: 'Radio 1',
      label: 'Before update',
      description: 'Spare handset',
    });
  });

  it('trims, drops blanks and caps length', () => {
    const out = normaliseBackupLabels({
      radioName: '  Radio 1  ',
      label: '   ',
      description: 'x'.repeat(RADIO_BACKUP_LABEL_MAX.description + 50),
    });
    expect(out.radioName).toBe('Radio 1');
    expect(out.label).toBeUndefined();
    expect(out.description).toHaveLength(RADIO_BACKUP_LABEL_MAX.description);
  });

  it('rejects a non-string label field', () => {
    expect(() => validateRadioBackupManifest({ ...manifest(), label: 3 })).toThrow(
      RadioBackupError,
    );
  });

  it('relabels a zip without touching regions or other manifest members', () => {
    const original = packRadioBackupZip(
      manifest({ label: 'Old' }),
      { r: bytes },
      {
        'debug/x.bin': Uint8Array.from([9]),
      },
    );
    const { zipBytes, manifest: next } = relabelRadioBackupZip(original, {
      radioName: 'Radio 2',
      description: 'Edited',
    });
    const parsed = parseRadioBackupZip(zipBytes);
    expect(parsed.manifest).toEqual(next);
    expect(parsed.manifest.label).toBeUndefined();
    expect(parsed.manifest.radioName).toBe('Radio 2');
    expect(parsed.manifest.capturedAt).toBe(manifest().capturedAt);
    expect(Array.from(parsed.regions.r!)).toEqual([1, 2, 3, 4]);
    expect(Array.from(parsed.sidecars['debug/x.bin']!)).toEqual([9]);
  });
});
