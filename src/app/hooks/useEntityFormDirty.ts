import { useCallback, useRef } from 'react';

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    return false;
  }
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }
  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;
  const aKeys = Object.keys(aRecord);
  const bKeys = Object.keys(bRecord);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => deepEqual(aRecord[key], bRecord[key]));
}

export interface UseEntityFormDirtyOptions<T> {
  /** Snapshot of the saved or initial form state (stable for the editor mount). */
  baseline: T;
  /** Builds the current entity from live form fields (same shape as baseline). */
  buildCurrent: () => T;
}

/**
 * Tracks whether an entity editor form differs from its baseline.
 * `permitNavigationOnce` bypasses the unsaved navigation guard for intentional
 * post-save navigation (refs update synchronously before `navigate()` runs).
 */
export function useEntityFormDirty<T>({ baseline, buildCurrent }: UseEntityFormDirtyOptions<T>) {
  const permitNavigationRef = useRef(false);

  const isDirty = !deepEqual(buildCurrent(), baseline);

  const permitNavigationOnce = useCallback(() => {
    permitNavigationRef.current = true;
  }, []);

  const resetPermitNavigation = useCallback(() => {
    permitNavigationRef.current = false;
  }, []);

  return { isDirty, permitNavigationRef, permitNavigationOnce, resetPermitNavigation };
}
