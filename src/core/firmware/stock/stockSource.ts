/**
 * Where stock firmware bytes come from. Today only the user's own files; a remote source would implement the same
 * interface. Sources never verify: every source's output goes through `resolveStockFirmware`.
 */
import type { NamedBytes, StockFirmwareDescriptor } from '../types.ts';

export interface StockSource {
  readonly kind: 'user-files' | 'remote';
  /** Produce the raw bytes the user supplied (or a future source fetched). No verification here. */
  load(
    descriptor: StockFirmwareDescriptor,
    opts?: { signal?: AbortSignal },
  ): Promise<readonly NamedBytes[]>;
}

/** The files the user picked. The app converts each `File` to `NamedBytes` before calling this. */
export function createUserFileStockSource(files: readonly NamedBytes[]): StockSource {
  const snapshot = [...files];
  return {
    kind: 'user-files',
    load(_descriptor, opts) {
      opts?.signal?.throwIfAborted();
      return Promise.resolve(snapshot);
    },
  };
}
