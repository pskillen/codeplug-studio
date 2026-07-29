/**
 * Persist write-verify snapshots across the radio reboot between Write and verify.
 */

import type { WriteVerifyKeptSnapshot } from '@integrations/radio-io/writeVerify.ts';
import {
  deserializeWriteVerifyStagingSnapshot,
  serializeWriteVerifyStagingSnapshot,
  type WriteVerifyPendingPayload,
  type WriteVerifyStagingSnapshotJson,
} from '@integrations/radio-io/writeVerify.ts';

const STORAGE_KEY = 'radioIo.writeVerify.pending';

export interface WriteVerifyStoredPayload {
  readonly buildId: string;
  readonly egressId: string;
  readonly profileId: string;
  readonly capturedAt: string;
  readonly staging: WriteVerifyStagingSnapshotJson;
  readonly kept?: WriteVerifyKeptSnapshot;
}

export function serializeWriteVerifyPending(
  buildId: string,
  egressId: string,
  profileId: string,
  pending: WriteVerifyPendingPayload,
): WriteVerifyStoredPayload {
  return {
    buildId,
    egressId,
    profileId,
    capturedAt: new Date().toISOString(),
    staging: serializeWriteVerifyStagingSnapshot(pending.staging),
    kept: pending.kept,
  };
}

export function deserializeWriteVerifyPending(
  payload: WriteVerifyStoredPayload,
): WriteVerifyPendingPayload {
  return {
    staging: deserializeWriteVerifyStagingSnapshot(payload.staging),
    kept: payload.kept,
  };
}

export function saveWriteVerifyPending(payload: WriteVerifyStoredPayload): boolean {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function loadWriteVerifyPending(
  buildId: string,
  egressId: string,
  profileId: string,
): WriteVerifyStoredPayload | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WriteVerifyStoredPayload;
    if (
      parsed.buildId !== buildId ||
      parsed.egressId !== egressId ||
      parsed.profileId !== profileId
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearWriteVerifyPending(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode */
  }
}
