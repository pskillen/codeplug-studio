/** Keps library freshness — stale after seven days without a CelesTrak/AMSAT refresh. */
export const KEPS_STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export interface KepsLastUpdatedFormat {
  label: string;
  stale: boolean;
}

export interface FormatKepsLastUpdatedOptions {
  /** Test hook — defaults to `Date.now()`. */
  now?: number;
}

/**
 * Format `ProjectMeta.satelliteLibraryLastUpdated` for display.
 * Not the same as TLE `epoch` or row `updatedAt`.
 */
export function formatKepsLastUpdated(
  iso: string | null | undefined,
  options: FormatKepsLastUpdatedOptions = {},
): KepsLastUpdatedFormat {
  const now = options.now ?? Date.now();
  if (!iso) return { label: 'Never refreshed', stale: true };
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return { label: 'Never refreshed', stale: true };
  const stale = now - at.getTime() > KEPS_STALE_AFTER_MS;
  return { label: `Last updated: ${at.toLocaleString()}`, stale };
}
