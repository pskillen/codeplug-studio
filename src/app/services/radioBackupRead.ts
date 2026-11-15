/**
 * Read-only backup application service — pack live reads, open archive files,
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
  normaliseBackupLabels,
  packRadioBackupZip,
  relabelRadioBackupZip,
  parseRadioBackupZip,
  regionsFromDownload,
  type ParsedRadioBackupZip,
  type RadioBackupLabels,
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
import { AT_D890_MAP_SIZE, D890_MAP } from '@integrations/radio-io/radios/at-d890uv/constants.ts';
import {
  cacheToMemoryMap,
  type AtD890DownloadCache,
} from '@integrations/radio-io/radios/at-d890uv/memory.ts';
import { AtD890uvProtocol } from '@integrations/radio-io/radios/at-d890uv/protocol.ts';
import type { Dm32ConfigWindow } from '@integrations/radio-io/radios/dm32uv/memory.ts';
import {
  DM32_CALIBRATION_JSON_PATH,
  DM32_FACTORY_JSON_PATH,
  buildDm32CalibrationBackupSidecars,
  dm32FactorySectorRegion,
} from '@integrations/radio-io/radios/dm32uv/calibrationDecode.ts';
import { Dm32uvProtocol } from '@integrations/radio-io/radios/dm32uv/protocol.ts';
import { OpenGd77Protocol } from '@integrations/radio-io/radios/opengd77/protocol.ts';
import {
  OPENGD77_BACKUP_USER_DATABASE_ID,
  OPENGD77_BACKUP_USER_DATABASE_LABEL,
} from '@integrations/radio-io/radios/opengd77/backupRestoreRoles.ts';
import { OPENUV380_USER_DB_HEADER_ABS } from '@integrations/radio-io/radios/opengd77/constants.ts';
import { Uv5rMiniProtocol } from '@integrations/radio-io/radios/uv5r-mini/protocol.ts';
import {
  uv5rMiniArchiveImageWithZoneTable,
  uv5rMiniBackupRestoreProfile,
  uv5rMiniZoneBackupRegion,
} from '@integrations/radio-io/radios/uv5r-mini/zoneBackup.ts';

export type RadioBackupSession = {
  source: 'live-read' | 'file';
  manifest: RadioBackupManifestV1;
  image: MemoryMap;
  inspectBag?: RadioCloneHydrationBag;
  zipBytes: Uint8Array;
  userDatabaseOccupied?: Uint8Array;
  /** DM-32 calibration sidecar. The eFuse UID in this JSON is not `manifest.serial`. */
  dm32CalibrationJson?: string;
  dm32FactoryJson?: string;
};

function sidecarText(
  sidecars: Record<string, Uint8Array> | undefined,
  path: string,
): string | undefined {
  const bytes = sidecars?.[path];
  if (!bytes || bytes.byteLength === 0) return undefined;
  return new TextDecoder().decode(bytes);
}

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
  /** Live V-frame `0x0A` window from `Dm32uvProtocol.getLiveConfigWindow`. */
  dm32ConfigWindow?: Dm32ConfigWindow;
  extraRegions?: readonly { region: RadioBackupManifestV1['regions'][number]; bytes: Uint8Array }[];
  sidecars?: Record<string, Uint8Array>;
  /** Operator's radio name, label and description; descriptive only. */
  labels?: RadioBackupLabels;
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
    dm32ConfigWindow: input.dm32ConfigWindow,
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
    ...normaliseBackupLabels(input.labels ?? {}),
  };
  if (input.firmware) manifest.firmware = input.firmware;
  if (serial) manifest.serial = serial;
  if (extract.restoreFragileAfterFactoryReset) {
    manifest.restoreFragileAfterFactoryReset = true;
  }
  if (extract.addressBase !== undefined) manifest.addressBase = extract.addressBase;
  if (extract.dm32ContactsBase !== undefined) manifest.dm32ContactsBase = extract.dm32ContactsBase;
  if (extract.dm32ContactsEnd !== undefined) manifest.dm32ContactsEnd = extract.dm32ContactsEnd;

  const zipBytes = packRadioBackupZip(manifest, extract.regionBytes, input.sidecars);
  return { manifest, zipBytes };
}

/**
 * Pack an AT-D890UV backup from a download cache the session already holds: no radio traffic. A Write
 * reads the same cache (`download()` is `cacheToMemoryMap(cache)`), so this is the zip a Backup of
 * that radio would have produced. Pass `cache` to pack a copy taken earlier (the Write's Review does,
 * so a later `upload()` cannot change what is saved). Does not download the zip.
 */
export function packAtD890BackupFromSession(
  session: RadioSession,
  opts?: { cache?: AtD890DownloadCache; capturedAt?: string },
): RadioBackupSession {
  const radio = session.radio;
  if (!(radio instanceof AtD890uvProtocol)) {
    throw new Error('Connected radio is not an AT-D890UV.');
  }
  const cache = opts?.cache ?? radio.getDownloadCache();
  if (!cache || cache.blocks.size === 0) {
    throw new Error('Nothing has been read from the radio yet.');
  }
  // Hydration reads the protocol's own cache, so a copy needs a protocol that holds the copy.
  let hydrationProtocol: AtD890uvProtocol = radio;
  if (opts?.cache) {
    hydrationProtocol = new AtD890uvProtocol();
    hydrationProtocol.seedDownloadCache(opts.cache);
  }
  return packAtD890BackupFromImage(
    session,
    cacheToMemoryMap(cache),
    opts?.capturedAt,
    hydrationProtocol,
  );
}

function packAtD890BackupFromImage(
  session: RadioSession,
  image: MemoryMap,
  capturedAt?: string,
  hydrationProtocol: CloneImageRadio = session.radio,
  labels?: RadioBackupLabels,
): RadioBackupSession {
  const firmware = session.radio.readFirmware(image) ?? undefined;
  const modelId = session.descriptor.modelIds[0] ?? 'radio';
  const inspectBag = session.descriptor.hydration.extractHydration(image, {
    sourceFileName: `web-serial:${modelId}`,
    protocol: hydrationProtocol,
    capturedAt: capturedAt ?? new Date().toISOString(),
  });
  const { manifest, zipBytes } = packLiveRadioBackup({
    descriptor: session.descriptor,
    image,
    inspectBag,
    firmware: firmware ?? inspectBag.retain.firmware,
    capturedAt: inspectBag.capturedAt,
    labels,
  });
  return { source: 'live-read', manifest, image, inspectBag, zipBytes };
}

export async function backupLiveRadioSession(
  session: RadioSession,
  opts?: {
    onProgress?: ProgressFn;
    signal?: AbortSignal;
    /** The build's Web Serial profile. The UV-5R Mini MM9PDY profile also backs up the zone table. */
    profileId?: string;
    download?: boolean;
    /** Operator's radio name, label and description, stored in the manifest. */
    labels?: RadioBackupLabels;
  },
): Promise<RadioBackupSession> {
  if (session.radio instanceof Uv5rMiniProtocol) {
    session.radio.setBackupRestoreProfile(uv5rMiniBackupRestoreProfile(opts?.profileId));
  }
  const image = await session.radio.download({
    onProgress: opts?.onProgress,
    signal: opts?.signal,
  });
  if (session.radio instanceof AtD890uvProtocol) {
    const packed = packAtD890BackupFromImage(
      session,
      image,
      undefined,
      session.radio,
      opts?.labels,
    );
    if (opts?.download !== false) downloadRadioBackupZip(packed.zipBytes, packed.manifest);
    return packed;
  }
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
  let archiveImage = image;
  if (
    session.radio instanceof Uv5rMiniProtocol &&
    session.radio.getBackupRestoreProfile() === 'mm9pdy'
  ) {
    const sector = await session.radio.downloadZoneTable({
      onProgress: opts?.onProgress,
      signal: opts?.signal,
    });
    extraRegions = [uv5rMiniZoneBackupRegion(sector)];
    archiveImage = uv5rMiniArchiveImageWithZoneTable(image, sector);
  }
  const dm32ConfigWindow =
    session.radio instanceof Dm32uvProtocol
      ? (session.radio.getLiveConfigWindow() ?? undefined)
      : undefined;
  let sidecars: Record<string, Uint8Array> | undefined;
  if (session.radio instanceof Dm32uvProtocol && dm32ConfigWindow) {
    const sector = session.radio.getFactorySector();
    const capture = session.radio.getFactorySectorCapture();
    if (sector) {
      const factory = dm32FactorySectorRegion(sector);
      extraRegions = [...(extraRegions ?? []), factory];
    }
    sidecars = await buildDm32CalibrationBackupSidecars({
      blocks: radioCloneSparseBlockBytes(inspectBag),
      window: dm32ConfigWindow,
      efuse: session.radio.getEfuseIdentity(),
      factorySector: sector,
      factoryNotKeptReason: capture.status === 'not-kept' ? capture.reason : null,
    });
  }
  const { manifest, zipBytes } = packLiveRadioBackup({
    descriptor: session.descriptor,
    image,
    inspectBag,
    firmware: firmware ?? inspectBag.retain.firmware,
    capturedAt: inspectBag.capturedAt,
    dm32ConfigWindow,
    extraRegions,
    sidecars,
    labels: opts?.labels,
  });
  if (opts?.download !== false) downloadRadioBackupZip(zipBytes, manifest);
  return {
    source: 'live-read',
    manifest,
    image: archiveImage,
    inspectBag,
    zipBytes,
    userDatabaseOccupied,
    dm32CalibrationJson: sidecarText(sidecars, DM32_CALIBRATION_JSON_PATH),
    dm32FactoryJson: sidecarText(sidecars, DM32_FACTORY_JSON_PATH),
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
  // AT-D890: regions above the virtual map (the NXDN list) stay in the zip as inspect-only files;
  // they are not placed in the image, which would otherwise grow to cover their addresses.
  const modelId = parsed.manifest.radioModelId.toLowerCase();
  const isD890 = modelId.includes('d890') || modelId === 'id890uv';
  const imageRegions = isD890
    ? parsed.manifest.regions.filter((region) => region.address < AT_D890_MAP_SIZE)
    : parsed.manifest.regions;
  const image = memoryMapFromBackupRegions(
    parsed.manifest.imageByteLength,
    imageRegions,
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
    dm32CalibrationJson: sidecarText(parsed.sidecars, DM32_CALIBRATION_JSON_PATH),
    dm32FactoryJson: sidecarText(parsed.sidecars, DM32_FACTORY_JSON_PATH),
  };
}

/**
 * Edit the radio name, label and description of a backup already held in the page. Only
 * `manifest.json` changes; regions, sidecars and the in-memory image are untouched.
 */
export function relabelRadioBackupSession(
  session: RadioBackupSession,
  labels: RadioBackupLabels,
): RadioBackupSession {
  const { zipBytes, manifest } = relabelRadioBackupZip(session.zipBytes, labels);
  return { ...session, zipBytes, manifest };
}
