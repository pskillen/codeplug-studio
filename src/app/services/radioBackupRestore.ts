/** Restore operations; archive and capture helpers live in the read-only service. */
import type { RadioBackupManifestV1 } from '@integrations/radio-io/backup/index.ts';
import type {
  CloneImageRadio,
  MemoryMap,
  ProgressFn,
  RadioDescriptor,
  RadioSession,
} from '@integrations/radio-io/types.ts';
import { AtD890uvProtocol } from '@integrations/radio-io/radios/at-d890uv/protocol.ts';
import { D890_MAP } from '@integrations/radio-io/radios/at-d890uv/constants.ts';
import { Dm32uvProtocol } from '@integrations/radio-io/radios/dm32uv/protocol.ts';
import { Uv5rMiniProtocol } from '@integrations/radio-io/radios/uv5r-mini/protocol.ts';
import {
  UV5R_MINI_ZONES_REGION_ID,
  uv5rMiniBackupRestoreProfile,
} from '@integrations/radio-io/radios/uv5r-mini/zoneBackup.ts';
import { UV5R_MINI_MODEL_ID } from '@integrations/radio-io/radios/uv5r-mini/hydration.ts';
import {
  atD890MaintenanceUnlocked,
  sanitiseAtD890RangeCode,
} from '@core/radios/anytone/at-d890uv/frequencyRange.ts';
import { readAtD890ConnectedRadioIdentity } from './radioIoSession.ts';
import { resolveRadioWriteGate } from './radioWriteEnvGate.ts';
export * from './radioBackupRead.ts';

export type RadioRestoreErrorCode =
  | 'model-mismatch'
  | 'serial-mismatch'
  | 'address-map-mismatch'
  | 'no-restore-hook'
  | 'no-restorable-regions'
  | 'prod-disabled';

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

/** Backup reads the radio through the descriptor's clone-image hooks; a radio without them has none. */
export function descriptorSupportsBackup(descriptor: RadioDescriptor | undefined): boolean {
  return typeof descriptor?.hydration?.extractHydration === 'function';
}

export function descriptorSupportsRestore(descriptor: RadioDescriptor | undefined): boolean {
  if (!descriptor) return false;
  return protocolSupportsRestore(descriptor.protocolFactory());
}

export function defaultRestorableRegionIds(
  manifest: RadioBackupManifestV1,
  /** The build's Web Serial profile: leaves out regions it cannot restore ({@link restoreRegionUnavailableReason}). */
  profileId?: string,
): string[] {
  return manifest.regions
    .filter((r) => r.restoreRole === 'restorable')
    .filter(
      (r) => profileId === undefined || !restoreRegionUnavailableReason(manifest, r, profileId),
    )
    .map((r) => r.id);
}

/**
 * Why a restorable region cannot be restored from this build's profile, or `null`. The UV-5R Mini zone table
 * restores on the MM9PDY profile only; the protocol refuses it on any other (a stock Restore leaves it out).
 */
export function restoreRegionUnavailableReason(
  manifest: RadioBackupManifestV1,
  region: RadioBackupManifestV1['regions'][number],
  profileId: string | undefined,
): string | null {
  if (
    manifest.radioModelId === UV5R_MINI_MODEL_ID &&
    region.id === UV5R_MINI_ZONES_REGION_ID &&
    uv5rMiniBackupRestoreProfile(profileId) !== 'mm9pdy'
  ) {
    return 'Restores from the UV-5R Mini (MM9PDY) target only';
  }
  return null;
}

export const RADIO_RESTORE_PROD_DISABLED_MESSAGE =
  'Restore to this radio target is disabled on the production site.';

/** Restore follows the Write gate: a profile whose Write is hidden on prod has no Restore there either. */
export function isRestoreHiddenForProfile(
  descriptor: RadioDescriptor | undefined,
  profileId: string | undefined,
  buildEnv?: string,
): boolean {
  return resolveRadioWriteGate(descriptor, buildEnv, profileId) === 'hidden';
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
    /** The build's Web Serial profile: the prod gate, and the UV-5R Mini MM9PDY zone table. */
    profileId?: string;
    /** Tests only: the deploy environment for the prod gate (default `__BUILD_ENV__`). */
    buildEnv?: string;
  },
): Promise<void> {
  if (!protocolSupportsRestore(session.radio) || !session.radio.restoreFromBackup) {
    throw new RadioRestoreError(
      'no-restore-hook',
      `Restore is not available for ${session.descriptor.label} yet.`,
    );
  }
  if (
    opts?.profileId !== undefined &&
    isRestoreHiddenForProfile(session.descriptor, opts.profileId, opts.buildEnv)
  ) {
    throw new RadioRestoreError('prod-disabled', RADIO_RESTORE_PROD_DISABLED_MESSAGE);
  }
  if (session.radio instanceof Uv5rMiniProtocol) {
    session.radio.setBackupRestoreProfile(uv5rMiniBackupRestoreProfile(opts?.profileId));
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

/**
 * The frequency range a D890 backup was taken on, as the radio would enforce it (above 18 reads as 0, and 14
 * without the `890#` unlock reads as 0). `undefined` when the archive holds no LocalInfo.
 */
export function atD890ArchiveRangeCode(archive: {
  manifest: RadioBackupManifestV1;
  image: MemoryMap;
}): number | undefined {
  if (!archive.manifest.regions.some((r) => r.id === 'local-info')) return undefined;
  if (archive.image.size < D890_MAP.LocalInfo + D890_MAP.LocalInfoLength) return undefined;
  const li = archive.image.get(D890_MAP.LocalInfo, D890_MAP.LocalInfoLength);
  return sanitiseAtD890RangeCode(li[0x03]!, atD890MaintenanceUnlocked(li));
}

/**
 * True when the connected D890's range (the sanitised code from its ident) differs from the one the archive was
 * taken on. Such a radio was wiped by the range change, so Restore must write every restorable region together:
 * the settings alone onto the still-default codeplug would stop the radio starting.
 */
export function atD890RangeMismatch(
  archive: { manifest: RadioBackupManifestV1; image: MemoryMap },
  liveIdentCode: number,
): boolean {
  const zipCode = atD890ArchiveRangeCode(archive);
  return zipCode !== undefined && zipCode !== liveIdentCode;
}

export const RESTORE_RANGE_MISMATCH_NOTE =
  "This radio's range has changed since the backup, so Studio restores everything together. Restoring settings alone would stop the radio starting.";
