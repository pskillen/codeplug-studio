import { FirmwareError } from '../errors.ts';
import { sha256Hex } from '../hash.ts';
import { parseFirmwarePatch } from '../patch/index.ts';
import { BUNDLED_FIRMWARE_RELEASES } from './index.ts';
import type {
  BundledFirmwareRelease,
  FirmwareReleaseSource,
  FirmwareReleaseSummary,
} from './types.ts';

export function bundledReleaseSummary(release: BundledFirmwareRelease): FirmwareReleaseSummary {
  return {
    radioId: release.radioId,
    key: release.tag,
    label: release.tag,
    channel: release.channel,
    provenance: 'bundled',
    release,
  };
}

/** Newest first by publication date, then tag. */
function compareReleases(a: BundledFirmwareRelease, b: BundledFirmwareRelease): number {
  if (a.publishedOn !== b.publishedOn) return a.publishedOn < b.publishedOn ? 1 : -1;
  return b.tag.localeCompare(a.tag, undefined, { numeric: true });
}

/** Release source over the bundled index. Pass rows in tests. */
export function createBundledFirmwareReleaseSource(
  rows: readonly BundledFirmwareRelease[] = BUNDLED_FIRMWARE_RELEASES,
): FirmwareReleaseSource {
  return {
    kind: 'bundled',
    async listReleases(radioId, { includeRc }) {
      return rows
        .filter((r) => r.radioId === radioId && (includeRc || r.channel === 'final'))
        .slice()
        .sort(compareReleases)
        .map(bundledReleaseSummary);
    },
    async loadPatch(radioId, key) {
      const release = rows.find((r) => r.radioId === radioId && r.tag === key);
      if (!release) {
        throw new FirmwareError(
          'patch-unreadable',
          `Release ${key} is not bundled for this radio.`,
        );
      }
      const bytes = await release.loadBytes();
      const sha256 = await sha256Hex(bytes);
      if (sha256 !== release.patchSha256) {
        throw new FirmwareError(
          'patch-unreadable',
          'Bundled patch bytes do not match the published hash',
        );
      }
      return { bytes, sha256, parsed: parseFirmwarePatch(bytes), provenance: 'bundled', release };
    },
  };
}

export const bundledFirmwareReleaseSource: FirmwareReleaseSource =
  createBundledFirmwareReleaseSource();
