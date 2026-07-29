/**
 * OpenGD77 write-verify support — region spans and kept snapshot helpers.
 */

import type { WriteVerifyRegionManifestEntry } from '../../writeVerifyCompare.ts';
import { OPENUV380_IMAGE_END } from './constants.ts';
import {
  OPENGD77_REGION_MANIFEST,
  openGd77KeptRegions,
  type OpenGd77RegionId,
} from './writeRole.ts';

const SORTED_MANIFEST = [...OPENGD77_REGION_MANIFEST].sort((a, b) => a.absAddress - b.absAddress);

export function openGd77KeptRegionLength(regionId: OpenGd77RegionId): number {
  const idx = SORTED_MANIFEST.findIndex((r) => r.id === regionId);
  if (idx < 0) throw new RangeError(`Unknown OpenGD77 region ${regionId}`);
  const start = SORTED_MANIFEST[idx]!.absAddress;
  const next = SORTED_MANIFEST[idx + 1];
  return (next?.absAddress ?? OPENUV380_IMAGE_END) - start;
}

export function buildOpenGd77VerifyManifest(): readonly WriteVerifyRegionManifestEntry[] {
  return SORTED_MANIFEST.map((region, idx) => {
    const next = SORTED_MANIFEST[idx + 1];
    const length = (next?.absAddress ?? OPENUV380_IMAGE_END) - region.absAddress;
    return {
      id: region.id,
      label: region.label,
      group: region.writeRole,
      start: region.absAddress,
      length,
    };
  });
}

export { openGd77KeptRegions };

export function keptRegionOverlapsStaging(
  regionId: OpenGd77RegionId,
  manifest: readonly WriteVerifyRegionManifestEntry[],
  staging: { readonly chunks: readonly { readonly address: number; readonly data: Uint8Array }[] },
): boolean {
  const region = manifest.find((r) => r.id === regionId);
  if (!region) return false;
  const regionEnd = region.start + region.length;
  return staging.chunks.some(({ address, data }) => {
    const chunkEnd = address + data.length;
    return address < regionEnd && chunkEnd > region.start;
  });
}
