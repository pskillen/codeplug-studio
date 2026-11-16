/**
 * Read-only OpenGD77 / OpenUV380 (DM-1701, MD-9600) debug capture.
 *
 * Every frame goes through `createOpenGd77DebugGuard` (byte-exact allow-list; see
 * docs/reference/radios/opengd77/protocol.md). The capture is FirmwareInfo, the registered FLASH
 * spans and, only when asked (`includeUserDatabase`), the occupied User Database, packed as an
 * inspect-only partial radio-backup archive. The User Database can run to megabytes, so it is
 * skipped by default and its region is then absent from the archive.
 * A failure or cancel returns no archive; the protocol closes the CPS screen once, and the
 * transport is closed whatever happens.
 */
import type {
  RadioBackupCapturedVia,
  RadioBackupManifestV1,
  RadioBackupRegionV1,
} from '../../backup/types.ts';
import { RADIO_BACKUP_FORMAT, RADIO_BACKUP_VERSION } from '../../backup/types.ts';
import { throwIfAborted } from '../../kit/progress.ts';
import type { BytePipe, MemoryMap, ProgressFn, RadioDescriptor } from '../../types.ts';
import {
  OPENGD77_BACKUP_FLASH_SPANS,
  OPENGD77_BACKUP_USER_DATABASE_ID,
  OPENGD77_BACKUP_USER_DATABASE_LABEL,
} from './backupRestoreRoles.ts';
import { OPENGD77_CALIBRATION_LENGTH } from '@core/radios/opengd77/calibration.ts';
import { OPENGD77_BLOCK } from '../../kit/codecs/opengd77Serial.ts';
import {
  OPENGD77_CALIBRATION_ADDRESS,
  OPENGD77_CALIBRATION_REGION_ID,
  OPENGD77_CALIBRATION_REGION_LABEL,
  OPENGD77_CALIBRATION_REGION_PATH,
  OPENUV380_USER_DB_HEADER_ABS,
} from './constants.ts';
import { createOpenGd77DebugGuard } from './debugGuard.ts';
import { readAbs } from './memory.ts';
import { OpenGd77Protocol, parseFirmwareInfo, readFlashRange } from './protocol.ts';

/**
 * Read the 512-byte calibration working copy: 16 mode-1 reads of 32 bytes from `0x10000`. The pipe
 * must be the debug guard's pipe. The firmware serves a read wholly inside the block from RAM.
 */
export async function readOpenGd77CalibrationWorkingCopy(
  pipe: BytePipe,
  onProgress?: ProgressFn,
): Promise<Uint8Array> {
  const out = new Uint8Array(OPENGD77_CALIBRATION_LENGTH);
  for (let off = 0; off < out.length; off += OPENGD77_BLOCK) {
    out.set(await readFlashRange(pipe, OPENGD77_CALIBRATION_ADDRESS + off, OPENGD77_BLOCK), off);
    onProgress?.({
      cur: off + OPENGD77_BLOCK,
      max: out.length,
      msg: `Reading calibration 0x${(OPENGD77_CALIBRATION_ADDRESS + off).toString(16)}`,
      stage: 'Calibration',
    });
  }
  return out;
}

/** The raw 46-byte FirmwareInfo reply, kept beside the regions. */
export const OPENGD77_DEBUG_FIRMWARE_INFO_SIDECAR = 'debug/firmware-info.bin';

export interface OpenGd77DebugCapture {
  modelId: string;
  capturedAt: string;
  capturedVia: RadioBackupCapturedVia;
  firmwareInfoRaw: Uint8Array;
  /** The OpenGD77 calibration working copy as returned at `0x10000` (512 bytes). */
  calibrationWorkingCopy: Uint8Array;
  image: MemoryMap;
  /**
   * Header + packed entries; the 12 header bytes alone when the header is not valid. Absent when
   * the operator did not ask for the User Database.
   */
  userDatabase?: Uint8Array;
}

/** Run the guarded read-only session. Closes the transport whatever happens. */
export async function captureOpenGd77DebugPipe(
  pipe: BytePipe,
  descriptor: RadioDescriptor,
  opts?: {
    signal?: AbortSignal;
    onProgress?: ProgressFn;
    capturedVia?: RadioBackupCapturedVia;
    /** Also read the occupied User Database (slow; can be megabytes). Off by default. */
    includeUserDatabase?: boolean;
  },
): Promise<OpenGd77DebugCapture> {
  const signal = opts?.signal;
  const guard = createOpenGd77DebugGuard(pipe, signal);
  const radio = descriptor.protocolFactory();
  try {
    if (!(radio instanceof OpenGd77Protocol)) {
      throw new Error('OpenGD77 descriptor returned an unexpected protocol.');
    }
    throwIfAborted(signal);
    // A wrong radio type throws RadioWrongIdentError here, before show CPS.
    opts?.onProgress?.({ cur: 0, max: 0, msg: 'Connecting…', stage: 'Connect' });
    const ident = await radio.connect(guard.pipe, { handshake: 'read', signal });
    // First, so a refusal or a silent radio costs seconds rather than the minutes of the flash spans.
    const calibrationWorkingCopy = await readOpenGd77CalibrationWorkingCopy(
      guard.pipe,
      opts?.onProgress,
    );
    const image = await radio.download({ onProgress: opts?.onProgress, signal });
    const userDatabase = opts?.includeUserDatabase
      ? await radio.downloadUserDatabaseOccupied({
          onProgress: opts?.onProgress,
          signal,
          keepInvalidHeader: true,
        })
      : undefined;
    throwIfAborted(signal);
    return {
      modelId: descriptor.modelIds[0]!,
      capturedAt: new Date().toISOString(),
      capturedVia: opts?.capturedVia ?? 'web-serial',
      firmwareInfoRaw: ident.raw.slice(),
      calibrationWorkingCopy,
      image,
      ...(userDatabase ? { userDatabase } : {}),
    };
  } finally {
    try {
      await radio.disconnect();
    } catch {
      /* Keep the original refusal, abort or error. */
    }
    try {
      await guard.pipe.close();
    } catch {
      /* Same. */
    }
  }
}

/** Manifest, region bytes and sidecars for a capture. Every region is inspect-only. */
export function buildOpenGd77DebugArchiveParts(capture: OpenGd77DebugCapture): {
  manifest: RadioBackupManifestV1;
  regions: Record<string, Uint8Array>;
  sidecars: Record<string, Uint8Array>;
} {
  const regions: Record<string, Uint8Array> = {};
  const list: RadioBackupRegionV1[] = [];
  for (const span of OPENGD77_BACKUP_FLASH_SPANS) {
    list.push({
      id: span.id,
      label: span.label,
      address: span.start,
      byteLength: span.length,
      path: `regions/${span.id}.bin`,
      restoreRole: 'inspect-only',
    });
    regions[span.id] = readAbs(capture.image, span.start, span.length);
  }
  if (capture.userDatabase) {
    list.push({
      id: OPENGD77_BACKUP_USER_DATABASE_ID,
      label: OPENGD77_BACKUP_USER_DATABASE_LABEL,
      address: OPENUV380_USER_DB_HEADER_ABS,
      byteLength: capture.userDatabase.length,
      path: `regions/${OPENGD77_BACKUP_USER_DATABASE_ID}.bin`,
      restoreRole: 'inspect-only',
    });
    regions[OPENGD77_BACKUP_USER_DATABASE_ID] = capture.userDatabase;
  }
  list.push({
    id: OPENGD77_CALIBRATION_REGION_ID,
    label: OPENGD77_CALIBRATION_REGION_LABEL,
    address: OPENGD77_CALIBRATION_ADDRESS,
    byteLength: capture.calibrationWorkingCopy.length,
    path: OPENGD77_CALIBRATION_REGION_PATH,
    restoreRole: 'inspect-only',
  });
  regions[OPENGD77_CALIBRATION_REGION_ID] = capture.calibrationWorkingCopy;

  let firmware: string | undefined;
  try {
    firmware = parseFirmwareInfo(capture.firmwareInfoRaw).fwRevision || undefined;
  } catch {
    firmware = undefined;
  }
  const manifest: RadioBackupManifestV1 = {
    format: RADIO_BACKUP_FORMAT,
    version: RADIO_BACKUP_VERSION,
    capturedAt: capture.capturedAt,
    capturedVia: capture.capturedVia,
    app: { buildEnv: __BUILD_ENV__, buildVersion: __BUILD_VERSION__ },
    radioModelId: capture.modelId,
    descriptorLabel: 'OpenGD77 debug capture',
    ...(firmware ? { firmware } : {}),
    coverage: 'known-map-regions',
    imageByteLength: capture.image.size,
    regions: list,
  };
  return {
    manifest,
    regions,
    sidecars: { [OPENGD77_DEBUG_FIRMWARE_INFO_SIDECAR]: capture.firmwareInfoRaw.slice() },
  };
}
