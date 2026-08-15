/**
 * Backup / Restore application service — pack live reads, open archive files,
 * and restore restorable regions onto a live session.
 * Zip on disk only; does not persist project state or run Write-codeplug preparation.
 * Must not import assemble, buildRadioWriteProjection, or prepareRadioWriteImage.
 */

import {
  radioCloneSparseBlockBytes,
  type RadioCloneHydrationBag,
} from '@core/models/radioCloneHydration.ts';
import { downloadZip, isoTimestampForFilename } from '@integrations/download/browserDownload.ts';
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
import type {
  CloneImageRadio,
  MemoryMap,
  ProgressFn,
  RadioDescriptor,
  RadioSession,
} from '@integrations/radio-io/types.ts';
import { formatAtD890LocalInfoSerial } from '@integrations/radio-io/radios/at-d890uv/identityCheck.ts';
import { D890_MAP } from '@integrations/radio-io/radios/at-d890uv/constants.ts';
import { AtD890uvProtocol } from '@integrations/radio-io/radios/at-d890uv/protocol.ts';
import { Dm32uvProtocol } from '@integrations/radio-io/radios/dm32uv/protocol.ts';
import { OpenGd77Protocol } from '@integrations/radio-io/radios/opengd77/protocol.ts';
import {
  OPENGD77_BACKUP_USER_DATABASE_ID,
  OPENGD77_BACKUP_USER_DATABASE_LABEL,
} from '@integrations/radio-io/radios/opengd77/backupRestoreRoles.ts';
import { OPENUV380_USER_DB_HEADER_ABS } from '@integrations/radio-io/radios/opengd77/constants.ts';

export type RadioBackupSession = {
  source: 'live-read' | 'file';
  manifest: RadioBackupManifestV1;
  image: MemoryMap;
  inspectBag?: RadioCloneHydrationBag;
  zipBytes: Uint8Array;
  userDatabaseOccupied?: Uint8Array;
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

export function downloadRadioBackupZip(
  zipBytes: Uint8Array,
  manifest: RadioBackupManifestV1,
): void {
  downloadZip(zipBytes, radioBackupFileName(manifest));
}

export function packLiveRadioBackup(input: {
  descriptor: RadioDescriptor;
  image: MemoryMap;
  inspectBag?: RadioCloneHydrationBag;
  firmware?: string;
  capturedAt?: string;
  extraRegions?: readonly { region: RadioBackupManifestV1['regions'][number]; bytes: Uint8Array }[];
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
    extraRegions: input.extraRegions,
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
  let extraRegions:
    { region: RadioBackupManifestV1['regions'][number]; bytes: Uint8Array }[] | undefined;
  let userDatabaseOccupied: Uint8Array | undefined;
  if (session.radio instanceof OpenGd77Protocol) {
    userDatabaseOccupied = await session.radio.downloadUserDatabaseOccupied({
      onProgress: opts?.onProgress,
      signal: opts?.signal,
    });
    if (userDatabaseOccupied.byteLength > 0) {
      extraRegions = [
        {
          region: {
            id: OPENGD77_BACKUP_USER_DATABASE_ID,
            label: OPENGD77_BACKUP_USER_DATABASE_LABEL,
            address: OPENUV380_USER_DB_HEADER_ABS,
            byteLength: userDatabaseOccupied.byteLength,
            path: `regions/${OPENGD77_BACKUP_USER_DATABASE_ID}.bin`,
            restoreRole: 'inspect-only',
          },
          bytes: userDatabaseOccupied,
        },
      ];
    }
  }
  const { manifest, zipBytes } = packLiveRadioBackup({
    descriptor: session.descriptor,
    image,
    inspectBag,
    firmware: firmware ?? inspectBag.retain.firmware,
    capturedAt: inspectBag.capturedAt,
    extraRegions,
  });
  downloadRadioBackupZip(zipBytes, manifest);
  return {
    source: 'live-read',
    manifest,
    image,
    inspectBag,
    zipBytes,
    userDatabaseOccupied,
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
  const userDatabaseOccupied = parsed.regions[OPENGD77_BACKUP_USER_DATABASE_ID];
  return {
    source: 'file',
    manifest: parsed.manifest,
    image,
    inspectBag,
    zipBytes: bytes,
    userDatabaseOccupied,
  };
}

export type RadioRestoreErrorCode =
  | 'model-mismatch'
  | 'serial-mismatch'
  | 'address-map-mismatch'
  | 'no-restore-hook'
  | 'no-restorable-regions';

export class RadioRestoreError extends Error {
  readonly code: RadioRestoreErrorCode;

  constructor(code: RadioRestoreErrorCode, message: string) {
    super(message);
    this.name = 'RadioRestoreError';
    this.code = code;
  }
}

/** Live DM-32 (and similar) address-map fields compared against the archive. */
export type RestoreAddressMapLive = {
  addressBase?: number;
  dm32ContactsBase?: number;
  dm32ContactsEnd?: number;
};

export function protocolSupportsRestore(radio: CloneImageRadio): boolean {
  return typeof radio.restoreFromBackup === 'function';
}

export function descriptorSupportsRestore(descriptor: RadioDescriptor | undefined): boolean {
  if (!descriptor) return false;
  return protocolSupportsRestore(descriptor.protocolFactory());
}

export function defaultRestorableRegionIds(manifest: RadioBackupManifestV1): string[] {
  return manifest.regions.filter((r) => r.restoreRole === 'restorable').map((r) => r.id);
}

/**
 * Operator may uncheck restorable rows. Inspect-only ids are dropped even if
 * the caller (or a tampered UI) includes them.
 */
export function filterRestoreRegionIds(
  manifest: RadioBackupManifestV1,
  requested?: readonly string[],
): string[] {
  const restorable = new Set(defaultRestorableRegionIds(manifest));
  const source = requested ?? [...restorable];
  return source.filter((id) => restorable.has(id));
}

/**
 * Refuse restore when a factory-reset-fragile archive's live bases differ.
 * DM-32 restore supplies {@link live}; omitted/partial live fields are not compared.
 */
export function assertRestoreAddressMap(
  manifest: RadioBackupManifestV1,
  live?: RestoreAddressMapLive,
): void {
  if (!manifest.restoreFragileAfterFactoryReset) return;
  if (!live) return;
  const fields = ['addressBase', 'dm32ContactsBase', 'dm32ContactsEnd'] as const;
  for (const field of fields) {
    const expected = manifest[field];
    const actual = live[field];
    if (expected !== undefined && actual !== undefined && expected !== actual) {
      throw new RadioRestoreError(
        'address-map-mismatch',
        `Restore refused — live ${field} 0x${actual.toString(16)} does not match backup 0x${expected.toString(16)}. After a factory reset this archive cannot be restored.`,
      );
    }
  }
}

export function readLiveRestoreAddressMap(
  session: RadioSession,
): RestoreAddressMapLive | undefined {
  if (session.radio instanceof Dm32uvProtocol) {
    return session.radio.getLiveRestoreAddressMap();
  }
  return undefined;
}

export async function readLiveRestoreSerial(
  session: RadioSession,
  opts?: { signal?: AbortSignal },
): Promise<string | undefined> {
  if (session.radio instanceof AtD890uvProtocol) {
    const { serial } = await readAtD890ConnectedRadioIdentity(session, opts);
    const trimmed = serial.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
}

export async function assertRestoreIdentity(
  session: RadioSession,
  manifest: RadioBackupManifestV1,
  opts?: { signal?: AbortSignal },
): Promise<{ serial?: string; firmware?: string; label: string }> {
  if (!session.descriptor.modelIds.includes(manifest.radioModelId)) {
    throw new RadioRestoreError(
      'model-mismatch',
      `Restore refused — connected radio (${session.descriptor.label}) does not match backup model ${manifest.radioModelId}.`,
    );
  }
  const liveSerial = await readLiveRestoreSerial(session, opts);
  const archived = manifest.serial?.trim();
  if (archived) {
    if (!liveSerial || liveSerial !== archived) {
      throw new RadioRestoreError(
        'serial-mismatch',
        `Restore refused — connected serial "${liveSerial ?? '(unreadable)'}" does not match backup serial "${archived}".`,
      );
    }
  }
  const firmware =
    (session.cachedImage ? session.radio.readFirmware(session.cachedImage) : undefined) ??
    manifest.firmware;
  return {
    serial: liveSerial ?? archived,
    firmware,
    label: session.descriptor.label,
  };
}

export async function restoreRadioBackup(
  session: RadioSession,
  archive: { manifest: RadioBackupManifestV1; image: MemoryMap },
  opts?: {
    regionIds?: readonly string[];
    liveAddressMap?: RestoreAddressMapLive;
    onProgress?: ProgressFn;
    signal?: AbortSignal;
  },
): Promise<void> {
  if (!protocolSupportsRestore(session.radio) || !session.radio.restoreFromBackup) {
    throw new RadioRestoreError(
      'no-restore-hook',
      `Restore is not available for ${session.descriptor.label} yet.`,
    );
  }
  await assertRestoreIdentity(session, archive.manifest, { signal: opts?.signal });
  const liveAddressMap = opts?.liveAddressMap ?? readLiveRestoreAddressMap(session);
  assertRestoreAddressMap(archive.manifest, liveAddressMap);
  const regionIds = filterRestoreRegionIds(archive.manifest, opts?.regionIds);
  if (regionIds.length === 0) {
    throw new RadioRestoreError(
      'no-restorable-regions',
      'Restore refused — no restorable regions are selected.',
    );
  }
  await session.radio.restoreFromBackup(archive, {
    regionIds,
    onProgress: opts?.onProgress,
    signal: opts?.signal,
  });
}
