import { FirmwareError } from '../errors.ts';
import { sha256Hex } from '../hash.ts';
import { parseFirmwarePatch } from '../patch/index.ts';
import { listStockFirmwareDescriptors } from '../stockCatalog.ts';
import type { StockFirmwareDescriptor } from '../types.ts';
import { checkPublishedPatch } from './publishedIndex.ts';
import { firmwareReleaseTitle } from './projects.ts';
import type {
  FirmwareReleaseSource,
  FirmwareReleaseSummary,
  PublishedFirmwareRelease,
} from './types.ts';

export function publishedReleaseSummary(release: PublishedFirmwareRelease): FirmwareReleaseSummary {
  return {
    radioId: release.radioId,
    key: release.tag,
    label: release.tag,
    title: firmwareReleaseTitle(release.patchName, release.tag),
    channel: release.channel,
    provenance: 'published',
    release,
  };
}

/** Newest first by publication date, then tag. */
function compareReleases(a: PublishedFirmwareRelease, b: PublishedFirmwareRelease): number {
  if (a.publishedOn !== b.publishedOn) return a.publishedOn < b.publishedOn ? 1 : -1;
  return b.tag.localeCompare(a.tag, undefined, { numeric: true });
}

/**
 * Release source over the published index. `loadRows` fetches it (integrations); pass fixed rows in tests.
 * Loading a release checks the downloaded bytes against the index hash, then the patch against the radio's pins.
 */
export function createPublishedFirmwareReleaseSource(
  loadRows: () => Promise<readonly PublishedFirmwareRelease[]>,
  descriptors: readonly StockFirmwareDescriptor[] = listStockFirmwareDescriptors(),
): FirmwareReleaseSource {
  return {
    kind: 'published',
    async listReleases(radioId, { includeRc }) {
      return (await loadRows())
        .filter((r) => r.radioId === radioId && (includeRc || r.channel === 'final'))
        .slice()
        .sort(compareReleases)
        .map(publishedReleaseSummary);
    },
    async loadPatch(radioId, key) {
      const release = (await loadRows()).find((r) => r.radioId === radioId && r.tag === key);
      const descriptor = descriptors.find((d) => d.radioId === radioId);
      if (!release || !descriptor) {
        throw new FirmwareError(
          'patch-unreadable',
          `Release ${key} is not published for this radio.`,
        );
      }
      const bytes = await release.loadBytes();
      const sha256 = await sha256Hex(bytes);
      if (sha256 !== release.patchSha256) {
        throw new FirmwareError(
          'patch-unreadable',
          'The downloaded patch does not match the published hash. Try again later.',
        );
      }
      const parsed = parseFirmwarePatch(bytes);
      checkPublishedPatch(release, parsed, descriptor);
      return { bytes, sha256, parsed, provenance: 'published', release };
    },
  };
}
