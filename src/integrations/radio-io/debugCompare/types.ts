import type { RadioBackupManifestV1 } from '../backup/types.ts';

/** What a compare needs of one capture; structurally a subset of the app's `DebugArchive`. */
export interface DebugCompareArchive {
  manifest: RadioBackupManifestV1;
  regions: Record<string, Uint8Array>;
  sidecars: Record<string, Uint8Array>;
}

/** A run of consecutive differing bytes, in absolute addresses. */
export interface ByteRun {
  start: number;
  length: number;
}

/**
 * How a section counts: `compared` decides the verdict; `reported` is diffed and shown but never
 * decides it; `skipped` is owned by the radio; `incomparable` has no established common footing.
 */
export type CompareSectionKind = 'compared' | 'reported' | 'skipped' | 'incomparable';

export interface CompareSection {
  id: string;
  label: string;
  kind: CompareSectionKind;
  reason?: string;
  /** Provenance, once per section, e.g. "main-body EEPROM via head". */
  note?: string;
  /** Archive region id, for sensitive-range lookup. */
  regionId?: string;
  /** Absolute address of byte 0 of `a` and `b`. */
  base: number;
  a?: Uint8Array;
  b?: Uint8Array;
  changed: number;
  /** Bytes present on one side only; counted as missing, never as changed. */
  missing: number;
  runs: readonly ByteRun[];
  /** True when more runs existed than the cap; `changed` stays exact. */
  runsTruncated: boolean;
}

export interface ByteComparison {
  sections: readonly CompareSection[];
  /** Set when the pair is refused as a whole (different radio models, no provenance). */
  error?: string;
}

/** The address space and byte representation of a region; two sides compare only if both match. */
export interface RegionIdentity {
  space: string;
  representation: string;
}

export interface DebugCompareAdapter {
  sections(a: DebugCompareArchive, b: DebugCompareArchive): ByteComparison;
  /** Address space and representation of a region of one archive; undefined when not established. */
  regionIdentity?(archive: DebugCompareArchive, regionId: string): RegionIdentity | undefined;
  /** Limits copy for this radio's compare, shown collapsed. */
  notes?: readonly { title: string; text: string }[];
}
