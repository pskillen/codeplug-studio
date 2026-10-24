import type { ParsedFirmwarePatch } from '../patch/types.ts';
import type { FirmwareRadioId } from '../types.ts';

export type FirmwareReleaseChannel = 'final' | 'rc';

/**
 * One firmware release from the firmware project's public release index (pskillen/mm9pdy-firmware `releases.json`).
 * Studio fetches the index and the patch at run time and checks both before anything is prepared.
 */
export interface PublishedFirmwareRelease {
  readonly radioId: FirmwareRadioId;
  /** Firmware-repo tag, no 'v' ('1.0.0', '1.0.0-rc.3'). */
  readonly tag: string;
  /** The patch's `name` (its firmware project), e.g. 'baofeng-dm32-firmware'. Names the release via `projects.ts`. */
  readonly patchName: string;
  readonly channel: FirmwareReleaseChannel;
  /** Published asset name, e.g. 'dm32-fw-1.0.0.patch.json'. */
  readonly patchFile: string;
  /** From the index; the downloaded bytes must match it. */
  readonly patchSha256: string;
  /** Must equal the radio's StockFirmwareDescriptor.version. */
  readonly stockVersion: string;
  /** ISO date. */
  readonly publishedOn: string;
  /** One or two sentences for the release list. */
  readonly summary: string;
  /** How the operator confirms this release is running. */
  readonly verifyHint: string;
  /** Result hashes by role, from the index so stock resolution can spot already-patched input; must equal the patch's. */
  readonly resultSha256: Readonly<Record<string, string>>;
  /** Downloads the exact published bytes. */
  readonly loadBytes: () => Promise<Uint8Array>;
  /** The release notes from the index (Studio's markdown subset). */
  readonly loadNotes: () => Promise<string>;
}

export interface FirmwareReleaseSummary {
  readonly radioId: FirmwareRadioId;
  /** Tag for a published release; 'user:<sha256>' for a user file. */
  readonly key: string;
  /** e.g. '1.0.0' */
  readonly label: string;
  /** Operator-facing name with the version, e.g. 'MM9PDY modded firmware 1.0.0'. */
  readonly title: string;
  readonly channel: FirmwareReleaseChannel | 'unknown';
  readonly provenance: 'published' | 'unreviewed';
  readonly release?: PublishedFirmwareRelease;
}

export interface LoadedFirmwarePatch {
  readonly bytes: Uint8Array;
  readonly sha256: string;
  readonly parsed: ParsedFirmwarePatch;
  readonly provenance: 'published' | 'unreviewed';
  /** Set when published, or a user file matching a published one. */
  readonly release?: PublishedFirmwareRelease;
}

export interface FirmwareReleaseSource {
  readonly kind: 'published' | 'user-file';
  listReleases(
    radioId: FirmwareRadioId,
    opts: { includeRc: boolean },
  ): Promise<readonly FirmwareReleaseSummary[]>;
  loadPatch(radioId: FirmwareRadioId, key: string): Promise<LoadedFirmwarePatch>;
}
