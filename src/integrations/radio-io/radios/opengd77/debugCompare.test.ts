import { describe, expect, it } from 'vitest';
import { makeOpenGd77FirmwareInfoPayload } from './__fixtures__/scriptedPipe.ts';
import { OPENGD77_BACKUP_USER_DATABASE_ID } from './backupRestoreRoles.ts';
import { compareOpenGd77Evidence, openGd77ComparisonEvidence } from './debugCompare.ts';
import {
  buildOpenGd77DebugArchiveParts,
  OPENGD77_DEBUG_FIRMWARE_INFO_SIDECAR,
} from './debugCapture.ts';
import { OPENGD77_DM1701_MODEL_ID } from './hydration.ts';
import { createOpenUv380Image } from './memory.ts';
import { encodeUserDatabaseHeader } from './userDatabaseCodec.ts';

function parts(
  opts: { revision?: string; entries?: number; radioType?: number; calibration?: Uint8Array } = {},
) {
  const entries = opts.entries ?? 2;
  const header = encodeUserDatabaseHeader(entries);
  const db = new Uint8Array(header.length + entries * 27);
  db.set(header);
  const info = makeOpenGd77FirmwareInfoPayload(opts.radioType ?? 0x08, { features: 0x04 });
  if (opts.revision) {
    info.fill(0, 8, 24);
    info.set(new TextEncoder().encode(opts.revision), 8);
  }
  return buildOpenGd77DebugArchiveParts({
    modelId: OPENGD77_DM1701_MODEL_ID,
    capturedAt: '2026-01-01T00:00:00.000Z',
    capturedVia: 'web-serial',
    firmwareInfoRaw: info,
    calibrationWorkingCopy: opts.calibration ?? new Uint8Array(512),
    image: createOpenUv380Image(),
    userDatabase: db,
  });
}

describe('openGd77ComparisonEvidence', () => {
  it('decodes identity and the User Database header from classified bytes', () => {
    const e = openGd77ComparisonEvidence(parts({ revision: 'R1' }));
    expect(e['Identity / Radio type']).toBe('DM-1701 / RT-84');
    expect(e['Identity / Revision']).toBe('R1');
    expect(e['User Database / Header valid']).toBe(true);
    expect(e['User Database / Entry count (header)']).toBe(2);
    expect(e['User Database / Captured bytes']).toBe(12 + 54);
  });

  it('names an invalid FirmwareInfo, never guesses, and leaves a missing one undefined', () => {
    const p = parts();
    const e = openGd77ComparisonEvidence({
      ...p,
      sidecars: { [OPENGD77_DEBUG_FIRMWARE_INFO_SIDECAR]: new Uint8Array(10) },
    });
    expect(e['Identity / Revision']).toEqual({ invalid: expect.stringMatching(/10 bytes/) });
    expect(e['Identity / Flash ID']).toEqual({ invalid: expect.stringMatching(/10 bytes/) });
    expect(openGd77ComparisonEvidence({ ...p, sidecars: {} })['Identity / Radio type']).toBe(
      undefined,
    );
  });

  it('reports an invalid User Database header and a missing region', () => {
    const p = parts();
    const regions = { ...p.regions, [OPENGD77_BACKUP_USER_DATABASE_ID]: new Uint8Array(66) };
    const bad = openGd77ComparisonEvidence({ ...p, regions });
    expect(bad['User Database / Header valid']).toBe(false);
    expect(bad['User Database / Entry count (header)']).toBeUndefined();
    const manifest = {
      ...p.manifest,
      regions: p.manifest.regions.filter((r) => r.id !== OPENGD77_BACKUP_USER_DATABASE_ID),
    };
    const missing = openGd77ComparisonEvidence({ ...p, manifest });
    expect(missing['User Database / Header valid']).toBeUndefined();
    expect(missing['User Database / Captured bytes']).toBeUndefined();
  });
});

describe('compareOpenGd77Evidence', () => {
  const status = (rows: ReturnType<typeof compareOpenGd77Evidence>, field: string) =>
    rows.find((r) => r.field === field)?.status;

  it('marks changed and unchanged fields', () => {
    const rows = compareOpenGd77Evidence(
      parts({ revision: 'R1' }),
      parts({ revision: 'R2', entries: 3 }),
    );
    expect(status(rows, 'Identity / Revision')).toBe('Changed');
    expect(status(rows, 'Identity / Build date')).toBe('Unchanged');
    expect(status(rows, 'User Database / Entry count (header)')).toBe('Changed');
  });

  it('marks a field unavailable when either side lacks it', () => {
    const p = parts();
    const rows = compareOpenGd77Evidence(p, { ...p, sidecars: {} });
    expect(status(rows, 'Identity / Revision')).toBe('Unavailable');
    expect(status(rows, 'User Database / Header valid')).toBe('Unchanged');
  });
});

describe('calibration evidence', () => {
  const cal = (seed: number) => {
    const bytes = new Uint8Array(512).map((_, i) => (i + seed) % 10);
    bytes.set([0x00, 0x25, 0x00, 0x40, 0x00, 0x45, 0x01, 0x40], 0x1b0);
    return bytes;
  };
  const status = (rows: ReturnType<typeof compareOpenGd77Evidence>, field: string) =>
    rows.find((r) => r.field === field)?.status;

  it('lists decoded rows as Changed or Unchanged', () => {
    const rows = compareOpenGd77Evidence(
      parts({ calibration: cal(0) }),
      parts({ calibration: cal(1) }),
    );
    expect(status(rows, 'Calibration / vox-level-1')).toBe('Changed');
    expect(status(rows, 'Calibration / uhf-frequency-0')).toBe('Unchanged');
    expect(status(rows, 'Calibration')).toBeUndefined();
  });

  it('is a single Unavailable field without a marker or without the region', () => {
    const rows = compareOpenGd77Evidence(parts(), parts({ calibration: cal(0) }));
    expect(status(rows, 'Calibration')).toBe('Unavailable');
    const p = parts({ calibration: cal(0) });
    const manifest = {
      ...p.manifest,
      regions: p.manifest.regions.filter((r) => r.id !== 'calibration-working-copy'),
    };
    expect(openGd77ComparisonEvidence({ ...p, manifest })['Calibration']).toBeUndefined();
  });
});
