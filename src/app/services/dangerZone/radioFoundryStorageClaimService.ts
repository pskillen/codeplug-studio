/**
 * RadioFoundry storage claim application service (Danger zone #2030).
 * The only app caller of the storage-claim session; never imports the sender (boundary test).
 */

import {
  packStorageClaimZip,
  storageClaimBinFileName,
  storageClaimZipFileName,
  tokenHex8,
  type StorageClaimManifest,
  type StorageClaimManifestFile,
  type StorageClaimRange,
} from '@core/radios/radiofoundry/storageClaim.ts';
import { sha256HexSync } from '@integrations/radio-io/digest/sha256Sync.ts';
import type { BytePipe } from '@integrations/radio-io/types.ts';
import { radioFoundryCableBoardForProfileId } from '@integrations/radio-io/radios/radiofoundry/board.ts';
import {
  createStorageClaimSession,
  storageClaimAcknowledgeBackupSaved,
  storageClaimBackup,
  storageClaimCheck,
  storageClaimPollForOurs,
  storageClaimRecheck,
  storageClaimUnlock,
  type StorageClaimCheckResult,
  type StorageClaimSessionState,
} from '@integrations/radio-io/radios/radiofoundry/storageClaim/index.ts';

export function cableBoardForStorageClaim(profileId: string) {
  return radioFoundryCableBoardForProfileId(profileId);
}

export function openStorageClaimState(pipe: BytePipe, profileId: string): StorageClaimSessionState {
  return createStorageClaimSession(pipe, cableBoardForStorageClaim(profileId));
}

export async function runStorageClaimCheck(
  state: StorageClaimSessionState,
  signal?: AbortSignal,
): Promise<StorageClaimCheckResult> {
  return storageClaimCheck(state, signal);
}

export async function runStorageClaimBackupDownload(
  state: StorageClaimSessionState,
  signal?: AbortSignal,
): Promise<{
  zipBytes: Uint8Array;
  fileName: string;
  manifest: StorageClaimManifest;
  tokenHex: string;
}> {
  const result = await storageClaimBackup(state, signal);
  const capturedAt = new Date();
  const files: StorageClaimManifestFile[] = [];
  const binBytes: Record<string, Uint8Array> = {};
  for (const range of Object.keys(result.ranges) as Array<keyof typeof result.ranges>) {
    const bytes = result.ranges[range];
    if (!bytes) continue;
    const kind = range as StorageClaimRange['kind'];
    const layout =
      kind === 'settings'
        ? result.layout.settings
        : kind === 'journal'
          ? result.layout.journal
          : result.layout.calibration;
    const path = storageClaimBinFileName(result.chip.token, capturedAt, kind, layout.address);
    files.push({
      kind,
      address: layout.address,
      size: layout.size,
      path,
      sha256: sha256HexSync(bytes),
    });
    binBytes[path] = bytes;
  }
  const manifest: StorageClaimManifest = {
    board: state.board.label,
    firmwareGit: 'unknown',
    storageInfo: result.layout,
    token: result.chip.token,
    tokenHex: tokenHex8(result.chip.token),
    uid0: result.chip.uid0,
    uid1: result.chip.uid1,
    uid2: result.chip.uid2,
    capturedAt: capturedAt.toISOString(),
    files,
  };
  const zipBytes = packStorageClaimZip(manifest, binBytes);
  return {
    zipBytes,
    fileName: storageClaimZipFileName(result.chip.token, capturedAt),
    manifest,
    tokenHex: tokenHex8(result.chip.token),
  };
}

export function acknowledgeStorageBackupSaved(state: StorageClaimSessionState): void {
  storageClaimAcknowledgeBackupSaved(state);
}

export const runStorageClaimUnlock = storageClaimUnlock;
export const pollStorageClaimForOurs = storageClaimPollForOurs;
export const recheckStorageClaim = storageClaimRecheck;
