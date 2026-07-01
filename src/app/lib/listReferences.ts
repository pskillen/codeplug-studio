import type { Library } from '@core/models/library.ts';
import { findReferencesTo, type ReferenceTarget } from '@core/domain/references.ts';

export function referenceCount(library: Library, target: ReferenceTarget): number {
  return findReferencesTo(library, target).length;
}

export function formatReferenceCount(count: number): string {
  return count === 0 ? '—' : String(count);
}
