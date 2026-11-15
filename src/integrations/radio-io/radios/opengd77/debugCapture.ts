/**
 * Read-only OpenGD77 / OpenUV380 (DM-1701, MD-9600) debug capture.
 *
 * Every frame goes through `createOpenGd77DebugGuard` (byte-exact allow-list; see
 * docs/reference/radios/opengd77/protocol.md). The capture is FirmwareInfo, the registered FLASH
 * spans and the occupied User Database, packed as an inspect-only partial radio-backup archive.
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
import { OPENUV380_USER_DB_HEADER_ABS } from './constants.ts';
import { createOpenGd77DebugGuard } from './debugGuard.ts';
import { readAbs } from './memory.ts';
import { OpenGd77Protocol, parseFirmwareInfo } from './protocol.ts';

/** The raw 46-byte FirmwareInfo reply, kept beside the regions. */
export const OPENGD77_DEBUG_FIRMWARE_INFO_SIDECAR = 'debug/firmware-info.bin';

export interface OpenGd77DebugCapture {
  modelId: string;
  capturedAt: string;
  capturedVia: RadioBackupCapturedVia;
  firmwareInfoRaw: Uint8Array;
  image: MemoryMap;
  /** Header + packed entries; the 12 header bytes alone when the header is not valid. */
  userDatabase: Uint8Array;
}

/** Run the guarded read-only session. Closes the transport whatever happens. */
export async function captureOpenGd77DebugPipe(
  pipe: BytePipe,
  descriptor: RadioDescriptor,
  opts?: { signal?: AbortSignal; onProgress?: ProgressFn; capturedVia?: RadioBackupCapturedVia },
): Promise<OpenGd77DebugCapture> {
  const signal = opts?.signal;
  const guard = createOpenGd77DebugGuard(pipe, signal);
  const radio = descriptor.protocolFactory();
  if (!(radio instanceof OpenGd77Protocol)) {
    throw new Error('OpenGD77 descriptor returned an unexpected protocol.');
  }
  try {
    throwIfAborted(signal);
    // A wrong radio type throws RadioWrongIdentError here, before show CPS.
    const ident = await radio.connect(guard.pipe, { handshake: 'read', signal });
    const image = await radio.download({ onProgress: opts?.onProgress, signal });
    const userDatabase = await radio.downloadUserDatabaseOccupied({
      onProgress: opts?.onProgress,
      signal,
      keepInvalidHeader: true,
    });
    throwIfAborted(signal);
    return {
      modelId: descriptor.modelIds[0]!,
      capturedAt: new Date().toISOString(),
      capturedVia: opts?.capturedVia ?? 'web-serial',
      firmwareInfoRaw: ident.raw.slice(),
      image,
      userDatabase,
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
  list.push({
    id: OPENGD77_BACKUP_USER_DATABASE_ID,
    label: OPENGD77_BACKUP_USER_DATABASE_LABEL,
    address: OPENUV380_USER_DB_HEADER_ABS,
    byteLength: capture.userDatabase.length,
    path: `regions/${OPENGD77_BACKUP_USER_DATABASE_ID}.bin`,
    restoreRole: 'inspect-only',
  });
  regions[OPENGD77_BACKUP_USER_DATABASE_ID] = capture.userDatabase;

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
