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

/**
 * One decoded value of a record. `value` undefined means not captured (never zero or empty).
 * A `sensitive` value (a password) is compared like any other but never leaves `diffDecoded`
 * unless the caller reveals it.
 */
export interface DecodedField {
  id: string;
  label: string;
  value?: string;
  sensitive?: boolean;
}

export interface DecodedIdentity {
  callsign?: string;
  name?: string;
}

export interface DecodedRecord {
  /** Matches the same record in the other capture; stable across reads (never a display name). */
  key: string;
  slot?: number;
  identity: DecodedIdentity;
  /** False for an empty slot; undefined means occupied. */
  occupied?: boolean;
  fields: readonly DecodedField[];
  caveats?: readonly string[];
  note?: string;
}

export interface DecodedDomain {
  id: string;
  label: string;
  /** True when this capture says which records exist and which are occupied. */
  occupancyCaptured: boolean;
  records: readonly DecodedRecord[];
  note?: string;
}

export type DecodedSnapshot = readonly DecodedDomain[];

export type FieldDiffKind = 'changed' | 'unchanged' | 'added' | 'removed' | 'incomparable';

export interface FieldDiff {
  id: string;
  label: string;
  kind: FieldDiffKind;
  /** Left out for a sensitive field unless revealed, and on the side a record lacks. */
  a?: string;
  b?: string;
  sensitive?: boolean;
}

export type RecordDiffKind = 'changed' | 'added' | 'removed' | 'unchanged' | 'incomparable';

export interface RecordDiff {
  domainId: string;
  key: string;
  slot?: number;
  /** Identity on each side, so a rename can read "(was ...)". */
  identityA?: DecodedIdentity;
  identityB?: DecodedIdentity;
  kind: RecordDiffKind;
  fields: readonly FieldDiff[];
  /** Fields that could not be compared (not captured on a side). */
  incomparableFields: number;
  caveats: readonly string[];
  note?: string;
}

export interface DomainDiffSummary {
  id: string;
  label: string;
  changed: number;
  added: number;
  removed: number;
  unchanged: number;
  incomparable: number;
  /** True when both captures say which records exist, so added and removed are meaningful. */
  occupancyCompared: boolean;
  note?: string;
}

export interface DebugCompareAdapter {
  sections(a: DebugCompareArchive, b: DebugCompareArchive): ByteComparison;
  /** The capture as decoded records, for the decoded diff. */
  decoded?(archive: DebugCompareArchive): DecodedSnapshot;
  /** Address space and representation of a region of one archive; undefined when not established. */
  regionIdentity?(archive: DebugCompareArchive, regionId: string): RegionIdentity | undefined;
  /** Limits copy for this radio's compare, shown collapsed. */
  notes?: readonly { title: string; text: string }[];
}
