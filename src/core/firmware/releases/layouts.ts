/**
 * A release with one file per flash layout (UV-5R Mini `L1`, `L2`): which layout a file is for, the loaded pair, and
 * picking from it. Vendor-neutral: the layouts and the build-name rule come from the radio's descriptor
 * (`releaseLayouts`). See docs/features/firmware-flashing/releases.md.
 */
import { FirmwareError } from '../errors.ts';
import type { FirmwarePatchDescription } from '../patch/types.ts';
import { stockVariants } from '../stockVariants.ts';
import type { StockFirmwareDescriptor } from '../types.ts';
import type { LoadedFirmwarePatch } from './types.ts';

/**
 * The refusal for a file whose build carries a layout tag that is not a release layout (a test-only build). The layout
 * is an internal detail (#1670): the words name the radio's firmware.
 */
export const NOT_A_RELEASE_LAYOUT = (
  descriptor: StockFirmwareDescriptor,
  buildName: string,
): string =>
  `${buildName} is not a release file for any ${descriptor.label} firmware Studio supports.`;

/**
 * The layout a patch's build name names, for a radio with release layouts. Undefined when the radio has none, or the
 * name carries no tag. Throws FirmwareError('patch-wrong-layout') for a tag that is not a release layout.
 */
export function layoutFromBuildName(
  descriptor: StockFirmwareDescriptor,
  buildName: string | undefined,
): string | undefined {
  const rl = descriptor.releaseLayouts;
  if (!rl || buildName === undefined) return undefined;
  const tag = rl.fromBuildName(buildName);
  if (tag !== undefined && !rl.layouts.includes(tag)) {
    throw new FirmwareError('patch-wrong-layout', NOT_A_RELEASE_LAYOUT(descriptor, buildName));
  }
  return tag;
}

/** The refusal for a file whose variant-form build name, base and pinned stock don't name one stock base. */
export const NOT_ONE_VARIANT = (descriptor: StockFirmwareDescriptor, buildName: string): string =>
  `${buildName} doesn't match the ${descriptor.label} firmware it is built on, so Studio can't tell which radios it is for.`;

/** A release version in a build name: X.Y.Z or X.Y.Z-rc.N, N from 1 to 9 (the radio's 21-character name, D133). */
const RELEASE_VERSION = /^\d+\.\d+\.\d+(-rc\.[1-9])?$/;
const LOOKS_LIKE_VERSION = /^\d+\.\d+\.\d+(-rc\.\d+)?$/;

/**
 * The layout a patch's build name leads to, for a radio with release layouts; undefined when it has none.
 *
 * - A name in a stock base's variant form (UV-5R Mini `v0.27-NRF-1.0.1`) is only a claim: the patch's own `base` must
 *   be that base, the base must be one of the radio's pinned stocks, and the patch must be built on exactly that
 *   stock's bytes. Then the layout is the base's (`layoutOfBase`), never read from the name. Where the rest of the name
 *   is a release version it must be the patch's version, and an RC above 9 is refused (no such release can exist).
 * - A legacy name (`mm9pdy-L2-…`) gives its layout tag, as before; a test-only tag (`V4`) is refused.
 *
 * Throws FirmwareError('patch-wrong-layout') on any disagreement, or for a variant-form name whose prefix is no base.
 */
export function buildNameLayout(
  descriptor: StockFirmwareDescriptor,
  description: Pick<FirmwarePatchDescription, 'buildName' | 'base' | 'version' | 'stock'>,
): string | undefined {
  const rl = descriptor.releaseLayouts;
  const { buildName } = description;
  if (!rl || buildName === undefined) return undefined;
  const named = rl.baseFromBuildName?.(buildName);
  if (named === undefined) return layoutFromBuildName(descriptor, buildName);
  if (named === null) {
    throw new FirmwareError('patch-wrong-layout', NOT_A_RELEASE_LAYOUT(descriptor, buildName));
  }
  const fail = () =>
    new FirmwareError('patch-wrong-layout', NOT_ONE_VARIANT(descriptor, buildName));
  if (description.base !== named.base) throw fail();
  const variant = stockVariants(descriptor).find((v) => v.baseName === named.base);
  if (!variant) throw fail();
  const roles = variant.members.map((m) => m.role).sort();
  if (Object.keys(description.stock).sort().join() !== roles.join()) throw fail();
  if (
    variant.members.some(
      (m) =>
        description.stock[m.role]?.sha256 !== m.sha256 ||
        description.stock[m.role]?.size !== m.size,
    )
  ) {
    throw fail();
  }
  if (LOOKS_LIKE_VERSION.test(named.rest)) {
    if (!RELEASE_VERSION.test(named.rest) || named.rest !== description.version) throw fail();
  }
  const layout = rl.layoutOfBase?.(named.base);
  if (layout === undefined || !rl.layouts.includes(layout)) throw fail();
  return layout;
}

/** Every file of a loaded release, the loaded one first, each without `otherLayouts`. */
export function layoutFiles(loaded: LoadedFirmwarePatch): readonly LoadedFirmwarePatch[] {
  const { otherLayouts, ...self } = loaded;
  return [self, ...(otherLayouts ?? [])];
}

/** The layouts a loaded release has files for, in the order loaded. Empty for a file with no layout. */
export function loadedLayouts(loaded: LoadedFirmwarePatch): readonly string[] {
  return layoutFiles(loaded).flatMap((f) => (f.layout === undefined ? [] : [f.layout]));
}

/**
 * One loaded release from its files, one per layout, in the descriptor's layout order: the first file carries the
 * others as `otherLayouts`. Throws FirmwareError('patch-wrong-layout') when a file has no layout or two share one.
 */
export function combineLayoutFiles(
  files: readonly LoadedFirmwarePatch[],
  descriptor: StockFirmwareDescriptor,
  what: string,
): LoadedFirmwarePatch {
  const order = descriptor.releaseLayouts?.layouts ?? [];
  const flat = files.flatMap(layoutFiles);
  if (flat.length === 1) return flat[0]!;
  const seen = new Set<string>();
  for (const f of flat) {
    if (f.layout === undefined) {
      throw new FirmwareError(
        'patch-wrong-layout',
        `Studio can't tell which radio firmware one of ${what} is for.`,
      );
    }
    // One file per layout and stock base: NRF and NRFB radios of one layout would get separate files.
    const key = `${f.layout} ${fileBase(f) ?? ''}`;
    if (seen.has(key)) {
      throw new FirmwareError(
        'patch-wrong-layout',
        `${what} has two files for the same radio firmware. A release has one file for each radio firmware it supports.`,
      );
    }
    seen.add(key);
  }
  const sorted = flat.slice().sort((a, b) => order.indexOf(a.layout!) - order.indexOf(b.layout!));
  const [first, ...rest] = sorted;
  return { ...first!, otherLayouts: rest };
}

/**
 * The file of a loaded release for `layout`, carrying the release's other files as `otherLayouts`. A file with no
 * layout (a radio without layouts, a to-stock or older build) is returned as is: the radio's interlocks decide. Undefined
 * when the release has files by layout but none for this one. Where the radio's stock base is known (`base`), the file
 * must also be built on it: a release row is identified by its whole base, and Studio never offers the nearest build.
 */
export function patchForLayout(
  loaded: LoadedFirmwarePatch,
  layout: string,
  base?: string,
): LoadedFirmwarePatch | undefined {
  const files = layoutFiles(loaded);
  if (files.every((f) => f.layout === undefined)) return loaded;
  const hit = files.find(
    (f) => f.layout === layout && (base === undefined || fileBase(f) === base),
  );
  if (!hit) return undefined;
  const rest = files.filter((f) => f !== hit);
  return rest.length ? { ...hit, otherLayouts: rest } : hit;
}

/** The stock base a file names (its patch's `base`), where it names one. */
export function fileBase(file: LoadedFirmwarePatch): string | undefined {
  return file.parsed?.description.base;
}

/** The stock bases a loaded release has files for, in the order loaded. */
export function loadedBases(loaded: LoadedFirmwarePatch): readonly string[] {
  return layoutFiles(loaded).flatMap((f) => {
    const b = fileBase(f);
    return b === undefined ? [] : [b];
  });
}

/**
 * The release's file for a layout other than `layout`, the retry partner; undefined when there is none. With
 * `variantOfBase` (radios whose variants get separate builds), the partner must be for the same variant as the file
 * refused (`refusedBase`): a file for another variant is never a partner.
 */
export function partnerFor(
  loaded: LoadedFirmwarePatch,
  layout: string,
  opts: {
    readonly refusedBase?: string;
    readonly variantOfBase?: (base: string) => string | undefined;
  } = {},
): LoadedFirmwarePatch | undefined {
  const { refusedBase, variantOfBase } = opts;
  const variant =
    variantOfBase && refusedBase !== undefined ? variantOfBase(refusedBase) : undefined;
  return layoutFiles(loaded).find((f) => {
    if (f.layout === undefined || f.layout === layout) return false;
    if (!variantOfBase) return true;
    const b = fileBase(f);
    return variant !== undefined && b !== undefined && variantOfBase(b) === variant;
  });
}
