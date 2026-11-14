import { FirmwareError } from '../errors.ts';
import { sha256Hex } from '../hash.ts';
import { parseFirmwarePatch } from '../patch/index.ts';
import { listStockFirmwareDescriptors } from '../stockCatalog.ts';
import { stockVariants } from '../stockVariants.ts';
import type { StockFirmwareDescriptor } from '../types.ts';
import { combineLayoutFiles } from './layouts.ts';
import { checkPublishedPatch, resolvePublishedLayout } from './publishedIndex.ts';
import { firmwareReleaseTitle } from './projects.ts';
import type {
  FirmwareReleaseSource,
  FirmwareReleaseSummary,
  LoadedFirmwarePatch,
  PublishedFirmwareRelease,
} from './types.ts';

export function publishedReleaseSummary(
  release: PublishedFirmwareRelease,
  supports?: readonly string[],
): FirmwareReleaseSummary {
  return {
    radioId: release.radioId,
    key: release.tag,
    label: release.tag,
    title: firmwareReleaseTitle(release.patchName, release.tag),
    channel: release.channel,
    provenance: 'published',
    release,
    ...(supports ? { supports } : {}),
  };
}

/**
 * The stock versions a release's rows are built on, in the radio's stock order, for a radio that accepts more than one
 * (`FirmwareReleaseSummary.supports`). Undefined for a radio with one stock version.
 */
export function releaseSupports(
  rows: readonly PublishedFirmwareRelease[],
  descriptor: StockFirmwareDescriptor | undefined,
): readonly string[] | undefined {
  if (!descriptor) return undefined;
  const versions = stockVariants(descriptor).map((v) => v.version);
  if (versions.length < 2) return undefined;
  return versions.filter((v) => rows.some((r) => r.stockVersion === v));
}

/** Newest first by publication date, then tag. */
export function compareReleases(a: PublishedFirmwareRelease, b: PublishedFirmwareRelease): number {
  if (a.publishedOn !== b.publishedOn) return a.publishedOn < b.publishedOn ? 1 : -1;
  return b.tag.localeCompare(a.tag, undefined, { numeric: true });
}

/** Download one row, check its bytes against the index hash and the patch against the radio's pins. */
async function loadRow(
  release: PublishedFirmwareRelease,
  descriptor: StockFirmwareDescriptor,
): Promise<LoadedFirmwarePatch> {
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
  const layout = resolvePublishedLayout(release, parsed, descriptor);
  return {
    bytes,
    sha256,
    parsed,
    provenance: 'published',
    release,
    ...(layout === undefined ? {} : { layout }),
  };
}

/**
 * Release source over the published index. `loadRows` fetches it (integrations); pass fixed rows in tests.
 * Loading a release checks the downloaded bytes against the index hash, then the patch against the radio's pins.
 * For a radio with release layouts a release is one row per layout: it is listed once, and loading it loads every
 * row of that version into one patch whose `otherLayouts` hold the rest.
 */
export function createPublishedFirmwareReleaseSource(
  loadRows: () => Promise<readonly PublishedFirmwareRelease[]>,
  descriptors: readonly StockFirmwareDescriptor[] = listStockFirmwareDescriptors(),
): FirmwareReleaseSource {
  return {
    kind: 'published',
    async listReleases(radioId, { includeRc }) {
      const sorted = (await loadRows())
        .filter((r) => r.radioId === radioId && (includeRc || r.channel === 'final'))
        .slice()
        .sort(compareReleases);
      // One entry per version: a layout radio's release is one row per layout. Its stock versions say which radios
      // it is for.
      const descriptor = descriptors.find((d) => d.radioId === radioId);
      const tags = new Set<string>();
      return sorted
        .filter((r) => !tags.has(r.tag) && Boolean(tags.add(r.tag)))
        .map((r) =>
          publishedReleaseSummary(
            r,
            releaseSupports(
              sorted.filter((s) => s.tag === r.tag),
              descriptor,
            ),
          ),
        );
    },
    async loadPatch(radioId, key) {
      const releases = (await loadRows()).filter((r) => r.radioId === radioId && r.tag === key);
      const descriptor = descriptors.find((d) => d.radioId === radioId);
      if (releases.length === 0 || !descriptor) {
        throw new FirmwareError(
          'patch-unreadable',
          `Release ${key} is not published for this radio.`,
        );
      }
      if (!descriptor.releaseLayouts) return loadRow(releases[0]!, descriptor);
      const files = await Promise.all(releases.map((r) => loadRow(r, descriptor)));
      return combineLayoutFiles(files, descriptor, `Release ${key}`);
    },
  };
}

/** One patch per stock base, preferring final releases to candidates. */
export function publishedToStockChoices(
  rows: readonly PublishedFirmwareRelease[],
  radioId: PublishedFirmwareRelease['radioId'],
): PublishedFirmwareRelease[] {
  const sorted = rows
    .filter((r) => r.radioId === radioId && r.base && r.toStock)
    .slice()
    .sort((a, b) =>
      a.channel === b.channel ? compareReleases(a, b) : a.channel === 'final' ? -1 : 1,
    );
  const bases = new Set<string>();
  return sorted
    .filter((r) => !bases.has(r.base!) && Boolean(bases.add(r.base!)))
    .sort(compareReleases);
}

export async function downloadToStockPatch(row: PublishedFirmwareRelease): Promise<Uint8Array> {
  if (!row.toStock)
    throw new FirmwareError('patch-unreadable', 'This to-stock patch is not published.');
  const bytes = await row.toStock.loadBytes();
  if ((await sha256Hex(bytes)) !== row.toStock.sha256)
    throw new FirmwareError(
      'patch-unreadable',
      'The downloaded to-stock patch does not match the published hash. Try again later.',
    );
  return bytes;
}
