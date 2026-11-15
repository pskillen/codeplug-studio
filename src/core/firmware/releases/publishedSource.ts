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

/**
 * A published release's key: its tag, and for a radio whose releases are keyed by stock base its base too
 * (`nrf-v0.27:1.0.0`, D133). The same version on two bases is two releases, never one.
 */
export function publishedReleaseKey(
  release: Pick<PublishedFirmwareRelease, 'tag' | 'base'>,
): string {
  return release.base === undefined ? release.tag : `${release.base}:${release.tag}`;
}

export function publishedReleaseSummary(
  release: PublishedFirmwareRelease,
  supports?: readonly string[],
): FirmwareReleaseSummary {
  return {
    radioId: release.radioId,
    key: publishedReleaseKey(release),
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

const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-rc\.(\d+))?$/;

/**
 * SemVer precedence of two release tags, newest first: X.Y.Z numerically, a final above its own RCs, RCs by number
 * (`rc.10` above `rc.2`). 0 when either is not a release tag.
 */
export function compareReleaseTags(a: string, b: string): number {
  const x = SEMVER.exec(a);
  const y = SEMVER.exec(b);
  if (!x || !y) return 0;
  for (let i = 1; i <= 3; i++) {
    const d = Number(y[i]) - Number(x[i]);
    if (d) return d;
  }
  const rc = (m: RegExpExecArray) => (m[4] === undefined ? Infinity : Number(m[4]));
  const d = rc(y) - rc(x);
  return Number.isNaN(d) ? 0 : d;
}

/**
 * Newest first. Releases keyed by stock base (both rows have a `base`) go by SemVer precedence, then base, since a
 * base's line has its own dates; everything else by publication date, then tag.
 */
export function compareReleases(a: PublishedFirmwareRelease, b: PublishedFirmwareRelease): number {
  if (a.base !== undefined && b.base !== undefined) {
    const byTag = compareReleaseTags(a.tag, b.tag);
    if (byTag) return byTag;
    if (a.publishedOn !== b.publishedOn) return a.publishedOn < b.publishedOn ? 1 : -1;
    return a.base.localeCompare(b.base);
  }
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
 * A release is one entry per key ({@link publishedReleaseKey}): for a radio keyed by stock base, one row per base and
 * version, and `base` lists only that base's releases. Rows of one key are loaded together (`otherLayouts`).
 */
export function createPublishedFirmwareReleaseSource(
  loadRows: () => Promise<readonly PublishedFirmwareRelease[]>,
  descriptors: readonly StockFirmwareDescriptor[] = listStockFirmwareDescriptors(),
): FirmwareReleaseSource {
  return {
    kind: 'published',
    async listReleases(radioId, { includeRc, base }) {
      const sorted = (await loadRows())
        .filter(
          (r) =>
            r.radioId === radioId &&
            (includeRc || r.channel === 'final') &&
            (base === undefined || r.base === base),
        )
        .slice()
        .sort(compareReleases);
      const descriptor = descriptors.find((d) => d.radioId === radioId);
      const keys = new Set<string>();
      return sorted
        .filter(
          (r) => !keys.has(publishedReleaseKey(r)) && Boolean(keys.add(publishedReleaseKey(r))),
        )
        .map((r) =>
          publishedReleaseSummary(
            r,
            releaseSupports(
              sorted.filter((s) => publishedReleaseKey(s) === publishedReleaseKey(r)),
              descriptor,
            ),
          ),
        );
    },
    async loadPatch(radioId, key) {
      const releases = (await loadRows()).filter(
        (r) => r.radioId === radioId && publishedReleaseKey(r) === key,
      );
      const descriptor = descriptors.find((d) => d.radioId === radioId);
      if (releases.length === 0 || !descriptor) {
        throw new FirmwareError(
          'patch-unreadable',
          `Release ${key} is not published for this radio.`,
        );
      }
      if (!descriptor.releaseLayouts) return loadRow(releases[0]!, descriptor);
      const files = await Promise.all(releases.map((r) => loadRow(r, descriptor)));
      return combineLayoutFiles(files, descriptor, `Release ${releases[0]!.tag}`);
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

/** What a radio on one stock base is offered from a listing of every base's releases ({@link releasesForBase}). */
export interface ReleasesForBase {
  /** The releases built on the radio's base, in listing order. */
  readonly forBase: readonly FirmwareReleaseSummary[];
  /**
   * The newest final release on another base, where it is newer than every final on the radio's base: this radio's
   * variant is behind (D134: one version is the same behaviour on every variant). Undefined otherwise.
   */
  readonly newerElsewhere?: FirmwareReleaseSummary;
}

/**
 * Narrow a listing to the radio's stock base (D133: a radio only ever gets a release built on its own base, picked by
 * base and version, never by version alone). With no base, or a listing without bases, the listing is returned whole.
 */
export function releasesForBase(
  list: readonly FirmwareReleaseSummary[],
  base: string | undefined,
): ReleasesForBase {
  if (base === undefined || list.every((s) => s.release?.base === undefined))
    return { forBase: list };
  const forBase = list.filter((s) => s.release?.base === base);
  const newestFinal = (rows: readonly FirmwareReleaseSummary[]) =>
    rows
      .filter((s) => s.channel === 'final')
      .slice()
      .sort((a, b) => compareReleaseTags(a.label, b.label))[0];
  const mine = newestFinal(forBase);
  const elsewhere = newestFinal(list.filter((s) => s.release?.base !== base));
  const ahead = elsewhere && (!mine || compareReleaseTags(mine.label, elsewhere.label) > 0);
  return ahead ? { forBase, newerElsewhere: elsewhere } : { forBase };
}
