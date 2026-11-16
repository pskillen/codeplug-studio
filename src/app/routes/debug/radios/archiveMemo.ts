import type { DebugArchive } from './captureArchive.ts';

/**
 * Memoise a pure projection of a debug archive by archive identity, so the Memory and Settings
 * tabs of one radio share a single decode instead of each computing it. Entries go when the
 * archive is garbage collected.
 */
export function memoByArchive<T>(
  project: (archive: DebugArchive) => T,
): (archive: DebugArchive) => T {
  const cache = new WeakMap<DebugArchive, T>();
  return (archive) => {
    if (cache.has(archive)) return cache.get(archive) as T;
    const value = project(archive);
    cache.set(archive, value);
    return value;
  };
}
