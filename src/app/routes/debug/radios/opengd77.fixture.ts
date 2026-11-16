/**
 * Test support: a synthetic OpenGD77 debug archive for DM-1701 / MD-9600, built by hand (no radio,
 * no scripted pipe). Shared by the OpenGD77 debug page tests; keep it generic.
 */
import { OPENUV380_USER_DB_ENTRY_SIZE } from '@integrations/radio-io/radios/opengd77/constants.ts';
import { makeOpenGd77FirmwareInfoPayload } from '@integrations/radio-io/radios/opengd77/__fixtures__/scriptedPipe.ts';
import { packRadioBackupZip } from '@integrations/radio-io/backup/index.ts';
import {
  OPENGD77_CALIBRATION_LENGTH,
  OPENGD77_CALIBRATION_MARKER,
  OPENGD77_CALIBRATION_MARKER_OFFSET,
} from '@core/radios/opengd77/calibration.ts';
import {
  buildOpenGd77DebugArchiveParts,
  type OpenGd77DebugCapture,
} from '@integrations/radio-io/radios/opengd77/debugCapture.ts';
import { OPENGD77_DM1701_MODEL_ID } from '@integrations/radio-io/radios/opengd77/hydration.ts';
import { createOpenUv380Image, writeAbs } from '@integrations/radio-io/radios/opengd77/memory.ts';
import { encodeUserDatabaseHeader } from '@integrations/radio-io/radios/opengd77/userDatabaseCodec.ts';
import { archiveOpenGd77Capture } from './opengd77Capture.ts';
import { openDebugArchive, type DebugArchive } from './captureArchive.ts';

/** Synthetic calibration bytes: BCD-valid digits everywhere, a distinct pattern, the local marker. */
export function syntheticOpenGd77Calibration(seed = 0, marker = true): Uint8Array {
  const bytes = new Uint8Array(OPENGD77_CALIBRATION_LENGTH);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = ((i * 7 + 3 + seed) % 10) | (((((i * 3) % 10) + (seed % 3)) % 10) << 4);
  }
  if (marker) bytes.set(OPENGD77_CALIBRATION_MARKER, OPENGD77_CALIBRATION_MARKER_OFFSET);
  return bytes;
}

/** A synthetic capture: planted bytes, a valid header plus N 27-byte entries, a FirmwareInfo reply. */
export function syntheticOpenGd77Capture(
  modelId: string,
  opts?: {
    radioType?: number;
    revision?: string;
    capturedAt?: string;
    userDatabaseEntries?: number;
    calibration?: Uint8Array;
  },
): OpenGd77DebugCapture {
  const radioType = opts?.radioType ?? (modelId === OPENGD77_DM1701_MODEL_ID ? 0x08 : 0x05);
  const entries = opts?.userDatabaseEntries ?? 2;
  const image = createOpenUv380Image();
  writeAbs(image, 0x80, new Uint8Array([0x53, 0x59, 0x4e]));
  writeAbs(image, 0x7500, new Uint8Array([0xa1, 0xa2]));
  writeAbs(image, 0x20000, new Uint8Array([0xb1]));
  writeAbs(image, 0x9b000, new Uint8Array([0xc1]));
  const header = encodeUserDatabaseHeader(entries);
  const userDatabase = new Uint8Array(header.length + entries * OPENUV380_USER_DB_ENTRY_SIZE);
  userDatabase.set(header);
  userDatabase.fill(0x5a, header.length);
  const firmwareInfoRaw = makeOpenGd77FirmwareInfoPayload(radioType, { features: 0x04 });
  if (opts?.revision) {
    firmwareInfoRaw.fill(0, 8, 24);
    firmwareInfoRaw.set(new TextEncoder().encode(opts.revision).subarray(0, 16), 8);
  }
  return {
    modelId,
    capturedAt: opts?.capturedAt ?? '2026-01-01T00:00:00.000Z',
    capturedVia: 'web-serial',
    firmwareInfoRaw,
    calibrationWorkingCopy: opts?.calibration ?? syntheticOpenGd77Calibration(),
    image,
    userDatabase,
  };
}

export async function syntheticOpenGd77Archive(
  modelId: string,
  opts?: {
    radioType?: number;
    revision?: string;
    capturedAt?: string;
    userDatabaseEntries?: number;
    /** `null` omits the region: the archive shape from before the calibration read. */
    calibration?: Uint8Array | null;
  },
): Promise<DebugArchive> {
  const { calibration, ...rest } = opts ?? {};
  const capture = syntheticOpenGd77Capture(modelId, {
    ...rest,
    ...(calibration ? { calibration } : {}),
  });
  if (calibration !== null) return archiveOpenGd77Capture(capture);
  const parts = buildOpenGd77DebugArchiveParts(capture);
  parts.manifest.regions = parts.manifest.regions.filter(
    (r) => r.id !== 'calibration-working-copy',
  );
  delete parts.regions['calibration-working-copy'];
  const zip = packRadioBackupZip(parts.manifest, parts.regions, parts.sidecars);
  return { ...openDebugArchive(zip, capture.modelId), source: 'live-read' };
}
