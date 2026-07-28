/**
 * Persist D890 write-verify snapshots across the radio reboot between Write and verify.
 */

import type { AtD890SentinelSnapshot } from '@integrations/radio-io/radios/at-d890uv/sentinelVerify.ts';
import type { AtD890WriteStagingSnapshot } from '@integrations/radio-io/radios/at-d890uv/writeMemoryVerify.ts';

const STORAGE_KEY = 'atD890.writeVerify.pending';

export interface AtD890WriteVerifyPendingPayload {
  readonly buildId: string;
  readonly egressId: string;
  readonly capturedAt: string;
  readonly staging: {
    readonly capturedAt: string;
    readonly chunks: readonly { readonly address: number; readonly data: readonly number[] }[];
  };
  readonly sentinelBefore: readonly { readonly id: string; readonly data: readonly number[] }[];
}

function bytesToJson(data: Uint8Array): number[] {
  return [...data];
}

function jsonToBytes(data: readonly number[]): Uint8Array {
  return Uint8Array.from(data);
}

export function serializeAtD890WriteVerifyPending(
  buildId: string,
  egressId: string,
  stagingSnapshot: AtD890WriteStagingSnapshot,
  sentinelBefore: AtD890SentinelSnapshot,
): AtD890WriteVerifyPendingPayload {
  return {
    buildId,
    egressId,
    capturedAt: new Date().toISOString(),
    staging: {
      capturedAt: stagingSnapshot.capturedAt,
      chunks: stagingSnapshot.chunks.map((c) => ({
        address: c.address,
        data: bytesToJson(c.data),
      })),
    },
    sentinelBefore: [...sentinelBefore.entries()].map(([id, data]) => ({
      id,
      data: bytesToJson(data),
    })),
  };
}

export function deserializeAtD890WriteVerifyPending(
  payload: AtD890WriteVerifyPendingPayload,
): {
  stagingSnapshot: AtD890WriteStagingSnapshot;
  sentinelBefore: AtD890SentinelSnapshot;
} {
  const stagingSnapshot: AtD890WriteStagingSnapshot = {
    capturedAt: payload.staging.capturedAt,
    chunks: payload.staging.chunks.map((c) => ({
      address: c.address,
      data: jsonToBytes(c.data),
    })),
  };
  const sentinelBefore = new Map<string, Uint8Array>();
  for (const { id, data } of payload.sentinelBefore) {
    sentinelBefore.set(id, jsonToBytes(data));
  }
  return { stagingSnapshot, sentinelBefore };
}

export function saveAtD890WriteVerifyPending(payload: AtD890WriteVerifyPendingPayload): boolean {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function loadAtD890WriteVerifyPending(
  buildId: string,
  egressId: string,
): AtD890WriteVerifyPendingPayload | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AtD890WriteVerifyPendingPayload;
    if (parsed.buildId !== buildId || parsed.egressId !== egressId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearAtD890WriteVerifyPending(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode */
  }
}
