import { FirmwareError } from '../errors.ts';
import { sha256Hex } from '../hash.ts';
import { parseFirmwarePatch } from '../patch/index.ts';
import { listStockFirmwareDescriptors } from '../stockCatalog.ts';
import type { FirmwareRadioId, NamedBytes, StockFirmwareDescriptor } from '../types.ts';
import { combineLayoutFiles, layoutFiles, layoutFromBuildName } from './layouts.ts';
import { checkPublishedPatch, resolvePublishedLayout } from './publishedIndex.ts';
import { publishedReleaseSummary } from './publishedSource.ts';
import { loadedFirmwarePatchTitle } from './projects.ts';
import type {
  PublishedFirmwareRelease,
  FirmwareReleaseSource,
  FirmwareReleaseSummary,
  LoadedFirmwarePatch,
} from './types.ts';

export interface UserPatchSourceOptions {
  /** Published rows to match against. Empty when the release list could not be fetched. */
  readonly rows: readonly PublishedFirmwareRelease[];
  /** Every radio's stock descriptor. Default: the stock catalog. */
  readonly descriptors?: readonly StockFirmwareDescriptor[];
}

/** The refusal for more files than the radio's release has. */
export const TOO_MANY_PATCH_FILES = (label: string, count: number): string =>
  count === 1
    ? `Pick one patch file: a ${label} release is one file.`
    : `Pick at most ${count} patch files: a ${label} release is one file for each radio firmware it supports.`;

/** The refusal for two files that are not the files of one release. */
export const NOT_ONE_RELEASE =
  "These files aren't the files of one release. Pick the files of the same release.";

/**
 * Patch files the operator picked from disk: one, or for a radio with release layouts one per layout (each file's
 * layout from its build name; a test-only layout tag is refused). Byte-identical to a published release for the same
 * radio → treated as that release. Otherwise `unreviewed`; its `name` must belong to the radio. More than one file
 * must be one release: same project and version, all published or none, and one file per layout.
 */
export function createUserPatchSource(
  files: NamedBytes | readonly NamedBytes[],
  opts: UserPatchSourceOptions,
): FirmwareReleaseSource {
  const list: readonly NamedBytes[] = Array.isArray(files) ? files : [files as NamedBytes];
  const { rows } = opts;
  const descriptors = opts.descriptors ?? listStockFirmwareDescriptors();
  let cache: Promise<string[]> | null = null;
  const hashes = () => (cache ??= Promise.all(list.map((f) => sha256Hex(f.bytes))));

  async function loadOne(
    radioId: FirmwareRadioId,
    file: NamedBytes,
    sha256: string,
  ): Promise<LoadedFirmwarePatch> {
    const descriptor = descriptors.find((d) => d.radioId === radioId);
    const published = rows.find((r) => r.radioId === radioId && r.patchSha256 === sha256);
    const parsed = parseFirmwarePatch(file.bytes);
    const layoutOf = () =>
      descriptor ? layoutFromBuildName(descriptor, parsed.description.buildName) : undefined;
    if (published && descriptor) {
      // The same checks as a download of that row: its base and layout must agree with the patch.
      checkPublishedPatch(published, parsed, descriptor);
      const layout = resolvePublishedLayout(published, parsed, descriptor);
      return {
        bytes: file.bytes,
        sha256,
        parsed,
        provenance: 'published',
        release: published,
        ...(layout === undefined ? {} : { layout }),
      };
    }
    if (!descriptor?.patchNames.includes(parsed.description.name)) {
      const owner = descriptors.find((d) => d.patchNames.includes(parsed.description.name));
      throw new FirmwareError(
        'patch-wrong-radio',
        owner
          ? `This patch is for the ${owner.label}.`
          : `This patch is not for the ${descriptor?.label ?? 'chosen radio'}.`,
      );
    }
    const layout = layoutOf();
    return {
      bytes: file.bytes,
      sha256,
      parsed,
      provenance: 'unreviewed',
      ...(layout === undefined ? {} : { layout }),
    };
  }

  async function load(radioId: FirmwareRadioId): Promise<LoadedFirmwarePatch> {
    const descriptor = descriptors.find((d) => d.radioId === radioId);
    const most = descriptor?.releaseLayouts?.layouts.length ?? 1;
    if (list.length > most) {
      throw new FirmwareError(
        'patch-wrong-layout',
        TOO_MANY_PATCH_FILES(descriptor?.label ?? 'chosen radio', most),
      );
    }
    const shas = await hashes();
    const loaded = await Promise.all(list.map((f, i) => loadOne(radioId, f, shas[i]!)));
    if (loaded.length === 1) return loaded[0]!;
    const [first, ...rest] = loaded;
    const { name, version } = first!.parsed.description;
    if (
      rest.some(
        (f) =>
          f.provenance !== first!.provenance ||
          f.parsed.description.name !== name ||
          f.parsed.description.version !== version,
      )
    ) {
      throw new FirmwareError('patch-wrong-layout', NOT_ONE_RELEASE);
    }
    return combineLayoutFiles(loaded, descriptor!, 'This pick');
  }

  const keyOf = (loaded: LoadedFirmwarePatch) =>
    `user:${layoutFiles(loaded)
      .map((f) => f.sha256)
      .join('+')}`;

  function summarise(
    radioId: FirmwareRadioId,
    loaded: LoadedFirmwarePatch,
  ): FirmwareReleaseSummary {
    if (loaded.release) return { ...publishedReleaseSummary(loaded.release), key: keyOf(loaded) };
    return {
      radioId,
      key: keyOf(loaded),
      label: loaded.parsed.description.version,
      title: loadedFirmwarePatchTitle(loaded),
      channel: 'unknown',
      provenance: 'unreviewed',
    };
  }

  return {
    kind: 'user-file',
    async listReleases(radioId) {
      return [summarise(radioId, await load(radioId))];
    },
    async loadPatch(radioId, key) {
      const loaded = await load(radioId);
      if (key !== keyOf(loaded)) {
        throw new FirmwareError('patch-unreadable', 'This patch file has changed. Pick it again.');
      }
      return loaded;
    },
  };
}
