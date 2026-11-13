/**
 * A release with one file per flash layout (UV-5R Mini `L1`, `L2`): which layout a file is for, the loaded pair, and
 * picking from it. Vendor-neutral: the layouts and the build-name rule come from the radio's descriptor
 * (`releaseLayouts`). See docs/features/firmware-flashing/releases.md.
 */
import { FirmwareError } from '../errors.ts';
import type { StockFirmwareDescriptor } from '../types.ts';
import type { LoadedFirmwarePatch } from './types.ts';

/** The refusal for a file whose build carries a layout tag that is not a release layout (a test-only build). */
export const NOT_A_RELEASE_LAYOUT = (
  descriptor: StockFirmwareDescriptor,
  buildName: string,
  tag: string,
): string =>
  `${buildName} is a ${tag} build, not a release file for one of the ${descriptor.label}'s flash layouts (${descriptor.releaseLayouts?.layouts.join(', ') ?? ''}).`;

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
    throw new FirmwareError('patch-wrong-layout', NOT_A_RELEASE_LAYOUT(descriptor, buildName, tag));
  }
  return tag;
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
        `Studio can't tell which flash layout one of ${what} is for.`,
      );
    }
    if (seen.has(f.layout)) {
      throw new FirmwareError(
        'patch-wrong-layout',
        `${what} has two files for ${f.layout}. A release has one file per flash layout.`,
      );
    }
    seen.add(f.layout);
  }
  const sorted = flat.slice().sort((a, b) => order.indexOf(a.layout!) - order.indexOf(b.layout!));
  const [first, ...rest] = sorted;
  return { ...first!, otherLayouts: rest };
}

/**
 * The file of a loaded release for `layout`, carrying the release's other files as `otherLayouts`. A file with no
 * layout (a radio without layouts, a to-stock or older build) is returned as is: the radio's interlocks decide. Undefined
 * when the release has files by layout but none for this one.
 */
export function patchForLayout(
  loaded: LoadedFirmwarePatch,
  layout: string,
): LoadedFirmwarePatch | undefined {
  const files = layoutFiles(loaded);
  if (files.every((f) => f.layout === undefined)) return loaded;
  const hit = files.find((f) => f.layout === layout);
  if (!hit) return undefined;
  const rest = files.filter((f) => f !== hit);
  return rest.length ? { ...hit, otherLayouts: rest } : hit;
}

/** The release's file for a layout other than `layout`, the retry partner; undefined when there is none. */
export function partnerFor(
  loaded: LoadedFirmwarePatch,
  layout: string,
): LoadedFirmwarePatch | undefined {
  return layoutFiles(loaded).find((f) => f.layout !== undefined && f.layout !== layout);
}
