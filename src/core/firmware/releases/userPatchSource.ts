import { FirmwareError } from '../errors.ts';
import { sha256Hex } from '../hash.ts';
import { parseFirmwarePatch } from '../patch/index.ts';
import { listStockFirmwareDescriptors } from '../stockCatalog.ts';
import type { FirmwareRadioId, NamedBytes, StockFirmwareDescriptor } from '../types.ts';
import { bundledReleaseSummary } from './bundledSource.ts';
import { BUNDLED_FIRMWARE_RELEASES } from './index.ts';
import type {
  BundledFirmwareRelease,
  FirmwareReleaseSource,
  FirmwareReleaseSummary,
  LoadedFirmwarePatch,
} from './types.ts';

export interface UserPatchSourceOptions {
  /** Bundled rows to match against. Default: the bundled index. */
  readonly rows?: readonly BundledFirmwareRelease[];
  /** Every radio's stock descriptor. Default: the stock catalog. */
  readonly descriptors?: readonly StockFirmwareDescriptor[];
}

/**
 * A patch file the operator picked from disk. Byte-identical to a bundled release for the same radio → treated as
 * that release. Otherwise `unreviewed`; its `name` must belong to the radio.
 */
export function createUserPatchSource(
  file: NamedBytes,
  opts: UserPatchSourceOptions = {},
): FirmwareReleaseSource {
  const rows = opts.rows ?? BUNDLED_FIRMWARE_RELEASES;
  const descriptors = opts.descriptors ?? listStockFirmwareDescriptors();
  let cache: Promise<{ sha256: string }> | null = null;
  const hash = () => (cache ??= sha256Hex(file.bytes).then((sha256) => ({ sha256 })));

  async function load(radioId: FirmwareRadioId): Promise<LoadedFirmwarePatch> {
    const { sha256 } = await hash();
    const bundled = rows.find((r) => r.radioId === radioId && r.patchSha256 === sha256);
    const parsed = parseFirmwarePatch(file.bytes);
    if (bundled) {
      return { bytes: file.bytes, sha256, parsed, provenance: 'bundled', release: bundled };
    }
    const descriptor = descriptors.find((d) => d.radioId === radioId);
    if (!descriptor?.patchNames.includes(parsed.description.name)) {
      const owner = descriptors.find((d) => d.patchNames.includes(parsed.description.name));
      throw new FirmwareError(
        'patch-wrong-radio',
        owner
          ? `This patch is for the ${owner.label}.`
          : `This patch is not for the ${descriptor?.label ?? 'chosen radio'}.`,
      );
    }
    return { bytes: file.bytes, sha256, parsed, provenance: 'unreviewed' };
  }

  function summarise(
    radioId: FirmwareRadioId,
    loaded: LoadedFirmwarePatch,
  ): FirmwareReleaseSummary {
    if (loaded.release)
      return { ...bundledReleaseSummary(loaded.release), key: `user:${loaded.sha256}` };
    return {
      radioId,
      key: `user:${loaded.sha256}`,
      label: loaded.parsed.description.version,
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
      if (key !== `user:${loaded.sha256}`) {
        throw new FirmwareError('patch-unreadable', 'This patch file has changed. Pick it again.');
      }
      return loaded;
    },
  };
}
