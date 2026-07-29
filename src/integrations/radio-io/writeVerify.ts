/**
 * Radio-neutral cross-session write verify contracts.
 *
 * Adapters map family-specific staging / kept snapshots and compare engines at the
 * descriptor `writeVerify` hook boundary — app and report UI consume only these shapes.
 */

import type { ProgressFn, RadioSession } from './types.ts';

export interface WriteVerifyStagingChunk {
  readonly address: number;
  readonly data: Uint8Array;
}

export interface WriteVerifyStagingSnapshot {
  readonly capturedAt: string;
  readonly chunks: readonly WriteVerifyStagingChunk[];
}

/** JSON-serializable opaque bag — adapter owns entry shape (e.g. sentinel id → bytes). */
export type WriteVerifyKeptSnapshot = Record<string, unknown>;

export interface WriteVerifyRegionGroup {
  readonly id: string;
  readonly label: string;
}

export type WriteVerifyRegionStatus = 'match' | 'mismatch' | 'not_written' | 'skipped';

export interface WriteVerifyRegionRow {
  readonly id: string;
  readonly label: string;
  readonly group: string;
  readonly bytesRead: number;
  readonly stagedChunkCount: number;
  readonly mismatchedChunks: number;
  readonly status: WriteVerifyRegionStatus;
}

export type WriteVerifyMismatchKind = 'mismatch' | 'not_read';

export interface WriteVerifyMismatch {
  readonly kind: WriteVerifyMismatchKind;
  readonly address: number;
  readonly regionId: string;
  readonly regionLabel: string;
  readonly expected: Uint8Array;
  /** Absent when {@link kind} is `not_read` — never fabricate unread bytes. */
  readonly actual: Uint8Array | null;
}

export interface WriteVerifyKeptMismatch {
  readonly id: string;
  readonly label: string;
}

export interface WriteVerifyKeptCompareResult {
  readonly ok: boolean;
  readonly mismatches?: readonly WriteVerifyKeptMismatch[];
}

export interface WriteVerifyResult {
  readonly ok: boolean;
  readonly model: string;
  readonly elapsedMs: number;
  readonly totalBytesRead: number;
  /** ISO timestamp from the pre-commit staging snapshot. */
  readonly stagingCapturedAt: string;
  readonly staging: {
    readonly totalChunks: number;
    readonly excludedBookkeepingChunks?: number;
    readonly mismatchedChunks: number;
    readonly notReadChunks?: number;
    readonly mismatches: readonly WriteVerifyMismatch[];
  };
  /** Optional never-write / retained-region compare (D890: sentinel regions). */
  readonly kept?: WriteVerifyKeptCompareResult;
  readonly regions: readonly WriteVerifyRegionRow[];
  readonly regionGroups: readonly WriteVerifyRegionGroup[];
}

export interface WriteVerifyDebugContext {
  readonly buildId: string;
  readonly egressId: string;
  readonly formatId: string;
  readonly profileId: string;
  readonly measuredAt: string;
  readonly buildVersion?: string;
  readonly buildEnv?: string;
  readonly pageUrl?: string;
  readonly userAgent?: string;
}

export interface WriteVerifyCaptureResult {
  readonly staging: WriteVerifyStagingSnapshot;
  readonly kept?: WriteVerifyKeptSnapshot;
}

export interface WriteVerifyPendingPayload {
  readonly staging: WriteVerifyStagingSnapshot;
  readonly kept?: WriteVerifyKeptSnapshot;
}

export interface WriteVerifyHooks {
  /** Snapshot transmitted staging (and optional pre-upload kept regions) after upload completes. */
  captureAfterUpload(session: RadioSession): WriteVerifyCaptureResult | undefined;
  runVerify(
    session: RadioSession,
    pending: WriteVerifyPendingPayload,
    opts?: { onProgress?: ProgressFn; signal?: AbortSignal },
  ): Promise<WriteVerifyResult>;
  formatDebugMarkdown(result: WriteVerifyResult, context: WriteVerifyDebugContext): string;
  /** When true, operator must reconnect in a new session after radio restart (D890). */
  readonly requiresCrossSessionReconnect: boolean;
}

/** JSON-safe staging round-trip for sessionStorage (no adapter-specific fields). */
export interface WriteVerifyStagingSnapshotJson {
  readonly capturedAt: string;
  readonly chunks: readonly { readonly address: number; readonly data: readonly number[] }[];
}

export function serializeWriteVerifyStagingSnapshot(
  snapshot: WriteVerifyStagingSnapshot,
): WriteVerifyStagingSnapshotJson {
  return {
    capturedAt: snapshot.capturedAt,
    chunks: snapshot.chunks.map((c) => ({
      address: c.address,
      data: [...c.data],
    })),
  };
}

export function deserializeWriteVerifyStagingSnapshot(
  json: WriteVerifyStagingSnapshotJson,
): WriteVerifyStagingSnapshot {
  return {
    capturedAt: json.capturedAt,
    chunks: json.chunks.map((c) => ({
      address: c.address,
      data: Uint8Array.from(c.data),
    })),
  };
}
