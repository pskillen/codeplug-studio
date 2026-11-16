import { describe, expect, it } from 'vitest';
import { OPENGD77_CALIBRATION_MARKER } from '@core/radios/opengd77/calibration.ts';
import type { RadioBackupManifestV1 } from '../../backup/types.ts';
import { makeOpenGd77FirmwareInfoPayload } from './__fixtures__/scriptedPipe.ts';
import {
  buildOpenGd77DebugArchiveParts,
  OPENGD77_DEBUG_FIRMWARE_INFO_SIDECAR,
} from './debugCapture.ts';
import {
  OPENGD77_CALIBRATION_REGION_ID,
  OPENGD77_CALIBRATION_REGION_PATH,
  selectOpenGd77Calibration,
} from './debugCalibration.ts';
import { OPENGD77_DM1701_MODEL_ID, OPENGD77_MD9600_MODEL_ID } from './hydration.ts';
import { createOpenUv380Image } from './memory.ts';

function calibration(): Uint8Array {
  const bytes = new Uint8Array(512).map((_, i) => (i * 7) % 10);
  bytes.set(OPENGD77_CALIBRATION_MARKER, 0x1b0);
  return bytes;
}

function parts(modelId = OPENGD77_DM1701_MODEL_ID, radioType = 0x08, cal = calibration()) {
  return buildOpenGd77DebugArchiveParts({
    modelId,
    capturedAt: '2026-01-01T00:00:00.000Z',
    capturedVia: 'web-serial',
    firmwareInfoRaw: makeOpenGd77FirmwareInfoPayload(radioType),
    calibrationWorkingCopy: cal,
    image: createOpenUv380Image(),
    userDatabase: new Uint8Array(12),
  });
}

const withRegion = (
  p: ReturnType<typeof parts>,
  change: Partial<RadioBackupManifestV1['regions'][number]>,
) => ({
  ...p,
  manifest: {
    ...p.manifest,
    regions: p.manifest.regions.map((r) =>
      r.id === OPENGD77_CALIBRATION_REGION_ID ? { ...r, ...change } : r,
    ),
  },
});

const reason = (s: ReturnType<typeof selectOpenGd77Calibration>) =>
  s.status === 'unavailable' ? s.reason : undefined;

describe('selectOpenGd77Calibration', () => {
  it.each([
    ['DM-1701', OPENGD77_DM1701_MODEL_ID, 0x08, 'very-low'],
    ['DM-1701 RGB', OPENGD77_DM1701_MODEL_ID, 0x0a, 'very-low'],
    ['MD-9600', OPENGD77_MD9600_MODEL_ID, 0x05, 'mid-low'],
  ])('decodes %s with the model low slot', (_n, modelId, radioType, slot) => {
    const sel = selectOpenGd77Calibration(parts(modelId, radioType));
    expect(sel.status).toBe('ok');
    if (sel.status !== 'ok') return;
    expect(sel.model.calibrationLowSlot).toBe(slot);
    expect(sel.decode.markerPresent).toBe(true);
    expect(sel.bytes).toHaveLength(512);
    const label = sel.decode.rows.find((r) => r.id === 'uhf-low-slot-power')!.label;
    expect(label).toBe(slot === 'mid-low' ? 'Mid-low power' : 'Very-low power');
  });

  it('is not-captured without the region (older archive or a Backup ZIP)', () => {
    const p = parts();
    const manifest = {
      ...p.manifest,
      regions: p.manifest.regions.filter((r) => r.id !== OPENGD77_CALIBRATION_REGION_ID),
    };
    expect(selectOpenGd77Calibration({ ...p, manifest })).toEqual({ status: 'not-captured' });
  });

  it('is unavailable with no FirmwareInfo', () => {
    expect(reason(selectOpenGd77Calibration({ ...parts(), sidecars: {} }))).toMatch(
      /no FirmwareInfo.*model is not identified/,
    );
  });

  it('is unavailable with an invalid FirmwareInfo', () => {
    const p = parts();
    expect(
      reason(
        selectOpenGd77Calibration({
          ...p,
          sidecars: { [OPENGD77_DEBUG_FIRMWARE_INFO_SIDECAR]: new Uint8Array(10) },
        }),
      ),
    ).toMatch(/FirmwareInfo is invalid/);
  });

  it('is unavailable when the radio type does not belong to the archive model', () => {
    const r = reason(selectOpenGd77Calibration(parts(OPENGD77_DM1701_MODEL_ID, 0x05)));
    expect(r).toMatch(/MD-9600/);
    expect(r).toMatch(/DM-1701/);
  });

  it.each([
    ['address', { address: 0x10020 }, /not 0x10000/],
    ['length', { byteLength: 256 }, /256 bytes/],
    ['role', { restoreRole: 'restorable' as const }, /role is restorable/],
    ['path', { path: 'regions/other.bin' }, /path is regions\/other\.bin/],
  ])('is unavailable with a wrong region %s', (_what, change, pattern) => {
    expect(reason(selectOpenGd77Calibration(withRegion(parts(), change)))).toMatch(pattern);
  });

  it('is unavailable when the stored bytes are not 512 long', () => {
    const p = parts();
    const regions = { ...p.regions, [OPENGD77_CALIBRATION_REGION_ID]: new Uint8Array(100) };
    expect(reason(selectOpenGd77Calibration({ ...p, regions }))).toMatch(/100 long/);
  });

  it('keeps the registered path', () => {
    expect(OPENGD77_CALIBRATION_REGION_PATH).toBe('regions/calibration-working-copy.bin');
  });
});
