import type { ProgressFn, ProgressUpdate } from '../types.ts';
import { RadioAbortedError } from './errors.ts';

/** Throw RadioAbortedError when the signal is already aborted. */
export function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new RadioAbortedError();
  }
}

/**
 * Emit a progress update after checking AbortSignal.
 * No-ops when `onProgress` is omitted.
 */
export function reportProgress(
  onProgress: ProgressFn | undefined,
  update: ProgressUpdate,
  signal?: AbortSignal,
): void {
  assertNotAborted(signal);
  onProgress?.(update);
}

/**
 * Throw if aborted; otherwise return. Use at loop checkpoints during download/upload.
 */
export function throwIfAborted(signal?: AbortSignal): void {
  assertNotAborted(signal);
}
