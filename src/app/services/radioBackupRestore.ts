/**
 * Backup / Restore application service — pack live reads and open archive files.
 * Zip on disk only; does not persist project state or run Write-codeplug preparation.
 */

import {
  radioCloneSparseBlockBytes,
  type RadioCloneHydrationBag,
} from '@core/models/radioCloneHydration.ts';
import {
  downloadZip,
  isoTimestampForFilename,
} from '@integrations/download/browserDownload.ts';
import {
  RADIO_BACKUP_FORMAT,
  RADIO_BACKUP_VERSION,
  memoryMapFromBackupRegions,
  packRadioBackupZip,
  parseRadioBackupZip,
  regionsFromDownload,
  type ParsedRadioBackupZip,
  type RadioBackupManifestV1,
} from '@integrations/radio-io/backup/index.ts';
import { getRadioDescriptor } from '@integrations/radio-io/index.ts';
import type { MemoryMap, ProgressFn, RadioDescriptor, RadioSession } from '@integrations/radio-io/types.ts';
import { formatAtD890LocalInfoSerial } from '@integrations/radio-io/radios/at-d890uv/identityCheck.ts';
import { D890_MAP } from '@integrations/radio-io/radios/at-d890uv/constants.ts';

export type RadioBackupSession = {
  source: 'live-read' | 'file';
  manifest: RadioBackupManifestV1;
  image: MemoryMap;
  inspectBag?: RadioCloneHydrationBag;
  zipBytes: Uint8Array;
};

function sanitizeModelId(modelId: string): string {
  return modelId.replace(/[^\w.-]+/g, '_') || 'radio';
}

function backupFileName(modelId: string, capturedAt: string): string {
  const stamp = isoTimestampForFilename(new Date(capturedAt));
  return `radio-backup-${sanitizeModelId(modelId)}-${stamp}.zip`;
}

function d890SerialFromImage(image: MemoryMap): string | undefined {
  try {
    if (image.size >= D890_MAP.LocalInfo + D890_MAP.LocalInfoLength) {
      const local = image.get(D890_MAP.LocalInfo, D890_MAP.LocalInfoLength);
      const serial = formatAtD890LocalInfoSerial(local);
      return serial.length > 0 ? serial : undefined;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export function radioBackupFileName(manifest: RadioBackupManifestV1): string {
  return backupFileName(manifest.radioModelId, manifest.capturedAt);
}

export function downloadRadioBackupZip(zipBytes: Uint8Array, manifest: RadioBackupManifestV1): void {
  downloadZip(zipBytes, radioBackupFileName(manifest));
}

export function packLiveRadioBackup(input: {
  descriptor: RadioDescriptor;
  image: MemoryMap;
  inspectBag?: RadioCloneHydrationBag;
  firmware?: string;
  capturedAt?: string;
}): { manifest: RadioBackupManifestV1; zipBytes: Uint8Array } {
  const capturedAt = input.capturedAt ?? new Date().toISOString();
  const modelId = input.descriptor.modelIds[0] ?? 'radio';
  const sparse = input.inspectBag ? radioCloneSparseBlockBytes(input.inspectBag) : [];
  const extract = regionsFromDownload({
    modelId,
    image: input.image,
    sparseBlocks: sparse.length > 0 ? sparse : undefined,
    addressBase: input.inspectBag?.retain.addressBase,
    dm32ContactsBase: input.inspectBag?.retain.dm32ContactsBase,
    dm32ContactsEnd: input.inspectBag?.retain.dm32ContactsEnd,
  });

  const serial = d890SerialFromImage(input.image);
  const manifest: RadioBackupManifestV1 = {
    format: RADIO_BACKUP_FORMAT,
    version: RADIO_BACKUP_VERSION,
    capturedAt,
    capturedVia: 'web-serial',
    app: { buildEnv: __BUILD_ENV__, buildVersion: __BUILD_VERSION__ },
    radioModelId: modelId,
    descriptorLabel: input.descriptor.label,
    coverage: extract.coverage,
    imageByteLength: extract.imageByteLength,
    regions: extract.regions,
  };
  if (input.firmware) manifest.firmware = input.firmware;
  if (serial) manifest.serial = serial;
  if (extract.restoreFragileAfterFactoryReset) {
    manifest.restoreFragileAfterFactoryReset = true;
  }
  if (extract.addressBase !== undefined) manifest.addressBase = extract.addressBase;
  if (extract.dm32ContactsBase !== undefined) manifest.dm32ContactsBase = extract.dm32ContactsBase;
  if (extract.dm32ContactsEnd !== undefined) manifest.dm32ContactsEnd = extract.dm32ContactsEnd;

  const zipBytes = packRadioBackupZip(manifest, extract.regionBytes);
  return { manifest, zipBytes };
}

export async function backupLiveRadioSession(
  session: RadioSession,
  opts?: { onProgress?: ProgressFn; signal?: AbortSignal },
): Promise<RadioBackupSession> {
  const image = await session.radio.download({
    onProgress: opts?.onProgress,
    signal: opts?.signal,
  });
  const firmware = session.radio.readFirmware(image) ?? undefined;
  const modelId = session.descriptor.modelIds[0] ?? 'radio';
  const inspectBag = session.descriptor.hydration.extractHydration(image, {
    sourceFileName: `web-serial:${modelId}`,
    protocol: session.radio,
    capturedAt: new Date().toISOString(),
  });
  const { manifest, zipBytes } = packLiveRadioBackup({
    descriptor: session.descriptor,
    image,
    inspectBag,
    firmware: firmware ?? inspectBag.retain.firmware,
    capturedAt: inspectBag.capturedAt,
  });
  downloadRadioBackupZip(zipBytes, manifest);
  return {
    source: 'live-read',
    manifest,
    image,
    inspectBag,
    zipBytes,
  };
}

export function inspectBagFromBackupImage(
  manifest: RadioBackupManifestV1,
  image: MemoryMap,
): RadioCloneHydrationBag | undefined {
  const descriptor = getRadioDescriptor(manifest.radioModelId);
  if (!descriptor) return undefined;
  try {
    return descriptor.hydration.extractHydration(image, {
      sourceFileName: `radio-backup:${manifest.radioModelId}`,
      capturedAt: manifest.capturedAt,
    });
  } catch {
    return undefined;
  }
}

export function openRadioBackupZip(bytes: Uint8Array): RadioBackupSession {
  const parsed: ParsedRadioBackupZip = parseRadioBackupZip(bytes);
  const image = memoryMapFromBackupRegions(
    parsed.manifest.imageByteLength,
    parsed.manifest.regions,
    parsed.regions,
  );
  const inspectBag = inspectBagFromBackupImage(parsed.manifest, image);
  return {
    source: 'file',
    manifest: parsed.manifest,
    image,
    inspectBag,
    zipBytes: bytes,
  };
}
