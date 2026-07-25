/**
 * UV-5R Mini write-role manifest — thin wrapper over uv17pro-family.
 */

import { UV5R_MINI_LAYOUT } from '../uv17pro-family/layout.ts';
import {
  UV17PRO_WRITTEN_FROM_BUILD_LABELS,
  buildUv17ProRegionManifest,
  uv17ProKeptRegions,
  uv17ProWriteRole,
  type Uv17ProRegionManifestEntry,
  type Uv17ProWriteRole,
} from '../uv17pro-family/writeRole.ts';

export type Uv5rMiniWriteRole = Uv17ProWriteRole;

export type Uv5rMiniRegionId =
  'channels' | 'vfoA' | 'vfoB' | 'settings' | 'ani' | 'pttId' | 'upcode' | 'downcode';

export type Uv5rMiniRegionManifestEntry = Uv17ProRegionManifestEntry & { id: Uv5rMiniRegionId };

export const UV5R_MINI_WRITTEN_FROM_BUILD_LABELS = UV17PRO_WRITTEN_FROM_BUILD_LABELS;

export const UV5R_MINI_REGION_MANIFEST = buildUv17ProRegionManifest(
  UV5R_MINI_LAYOUT,
) as readonly Uv5rMiniRegionManifestEntry[];

export function uv5rMiniWriteRole(regionId: Uv5rMiniRegionId): Uv5rMiniWriteRole {
  return uv17ProWriteRole(UV5R_MINI_LAYOUT, regionId);
}

export function uv5rMiniRegionLabel(regionId: Uv5rMiniRegionId): string {
  const entry = UV5R_MINI_REGION_MANIFEST.find((r) => r.id === regionId);
  return entry?.label ?? 'Unknown region';
}

export function uv5rMiniKeptRegions(): readonly Uv5rMiniRegionManifestEntry[] {
  return uv17ProKeptRegions(UV5R_MINI_LAYOUT) as readonly Uv5rMiniRegionManifestEntry[];
}
