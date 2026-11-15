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
  /**
   * The flash layout this row's file is for, for a radio whose releases ship one file per layout (UV-5R Mini `L1`,
   * `L2`). Optional in the index: a row without one takes its base's layout once downloaded.
   */
  readonly layout?: string;
  /**
   * The stock base this row's file is built on (UV-5R Mini `nrf-v0.27`), for a radio with release layouts: always set
   * for one (the index's `base`, or the base its stock version names). A release is keyed by base and version (D133):
   * each base is a variant with its own SemVer line. A patch on another base is refused.
   */
  readonly base?: string;
  readonly toStock?: { readonly sha256: string; readonly loadBytes: () => Promise<Uint8Array> };
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
  /**
   * Tag for a published release, with its stock base for a radio keyed by base (`nrf-v0.27:1.0.0`); 'user:<sha256>'
   * for a user file.
   */
  readonly key: string;
  /** e.g. '1.0.0' */
  readonly label: string;
  /** Operator-facing name with the version, e.g. 'MM9PDY modded firmware 1.0.0'. */
  readonly title: string;
  readonly channel: FirmwareReleaseChannel | 'unknown';
  readonly provenance: 'published' | 'unreviewed';
  readonly release?: PublishedFirmwareRelease;
  /**
   * The stock versions the release's files are built on, in the radio's stock order (UV-5R Mini `v0.27 (NRF)`), so its
   * row can say which radios it is for. Set only for a radio that accepts more than one stock version.
   */
  readonly supports?: readonly string[];
}

export interface LoadedFirmwarePatch {
  readonly bytes: Uint8Array;
  readonly sha256: string;
  readonly parsed: ParsedFirmwarePatch;
  readonly provenance: 'published' | 'unreviewed';
  /** Set when published, or a user file matching a published one. */
  readonly release?: PublishedFirmwareRelease;
  /** The flash layout this file is for, for a radio whose releases ship one file per layout. */
  readonly layout?: string;
  /**
   * The same release's files for the radio's other layouts, each with its own `layout`. Prepare picks the file for
   * the radio's layout (`patchForLayout`); a refusal of that one offers the other (`partnerFor`).
   */
  readonly otherLayouts?: readonly LoadedFirmwarePatch[];
}

export interface FirmwareReleaseSource {
  readonly kind: 'published' | 'user-file';
  listReleases(
    radioId: FirmwareRadioId,
    /** `base`: only the releases for that stock base, for a radio whose releases are keyed by base (D133). */
    opts: { includeRc: boolean; base?: string },
  ): Promise<readonly FirmwareReleaseSummary[]>;
  loadPatch(radioId: FirmwareRadioId, key: string): Promise<LoadedFirmwarePatch>;
}
