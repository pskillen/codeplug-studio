import type { FormatBuild } from '@core/models/formatBuild.ts';

/**
 * Merge BuildLayout context with an optimistic local save.
 * Prefer the local save only while its revision is strictly ahead of context
 * (reload lag). When context catches up or advances from another writer
 * (e.g. zone grouping layout), use context so list chrome stays in sync.
 */
export function resolveOptimisticBuild(
  contextBuild: FormatBuild,
  savedBuild: FormatBuild | null,
): FormatBuild {
  if (savedBuild != null && savedBuild.revision > contextBuild.revision) {
    return savedBuild;
  }
  return contextBuild;
}
