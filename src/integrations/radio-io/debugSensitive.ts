import type { RadioBackupManifestV1 } from './backup/types.ts';

/** Absolute byte range `[start, end)` holding a secret that debug views mask until revealed. */
export interface DebugSensitiveRange {
  start: number;
  end: number;
  label: string;
}

/** The parts of a debug archive a radio's sensitive-range function may read. */
export interface DebugSensitiveArchive {
  manifest: RadioBackupManifestV1;
  regions: Record<string, Uint8Array>;
  sidecars: Record<string, Uint8Array>;
}

/**
 * A radio's password byte ranges inside one archive region, by region id. Returns nothing for an
 * archive of another radio, so a caller may ask every radio.
 */
export type DebugSensitiveRangesFn = (
  archive: DebugSensitiveArchive,
  regionId: string,
) => readonly DebugSensitiveRange[];
