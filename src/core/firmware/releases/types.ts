import type { ParsedFirmwarePatch } from '../patch/types.ts';
import type { FirmwareRadioId } from '../types.ts';

export type FirmwareReleaseChannel = 'final' | 'rc';

/** One firmware release bundled with Studio: a patch copied byte for byte from the firmware project's release. */
export interface BundledFirmwareRelease {
  readonly radioId: FirmwareRadioId;
  /** Firmware-repo tag, no 'v' ('1.0.0', '1.0.0-rc.3'). */
  readonly tag: string;
  readonly channel: FirmwareReleaseChannel;
  /** Published asset name, e.g. 'dm32-fw-1.0.0.patch.json'. */
  readonly patchFile: string;
  /** From the release's SHA256SUMS. */
  readonly patchSha256: string;
  /** Must equal the radio's StockFirmwareDescriptor.version. */
  readonly stockVersion: string;
  /** ISO date. */
  readonly publishedOn: string;
  /** One or two sentences for the release list. */
  readonly summary: string;
  /** How the operator confirms this release is running. */
  readonly verifyHint: string;
  /** Result hashes by role, duplicated from the patch so stock resolution can spot already-patched input. */
  readonly resultSha256: Readonly<Record<string, string>>;
  /** Exact published bytes. */
  readonly loadBytes: () => Promise<Uint8Array>;
  /** Studio copy of the release notes (markdown text). */
  readonly loadNotes: () => Promise<string>;
}

export interface FirmwareReleaseSummary {
  readonly radioId: FirmwareRadioId;
  /** Tag for bundled; 'user:<sha256>' for a user file. */
  readonly key: string;
  /** e.g. '1.0.0' */
  readonly label: string;
  readonly channel: FirmwareReleaseChannel | 'unknown';
  readonly provenance: 'bundled' | 'unreviewed';
  readonly release?: BundledFirmwareRelease;
}

export interface LoadedFirmwarePatch {
  readonly bytes: Uint8Array;
  readonly sha256: string;
  readonly parsed: ParsedFirmwarePatch;
  readonly provenance: 'bundled' | 'unreviewed';
  /** Set when bundled, or a user file matching a bundled one. */
  readonly release?: BundledFirmwareRelease;
}

export interface FirmwareReleaseSource {
  readonly kind: 'bundled' | 'user-file' | 'remote';
  listReleases(
    radioId: FirmwareRadioId,
    opts: { includeRc: boolean },
  ): Promise<readonly FirmwareReleaseSummary[]>;
  loadPatch(radioId: FirmwareRadioId, key: string): Promise<LoadedFirmwarePatch>;
}
