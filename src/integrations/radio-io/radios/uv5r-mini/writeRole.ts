/**
 * UV-5R Mini write-role manifest — single source of truth for encode vs retain.
 * Cite: tier-3 docs/reference/radios/baofeng/uv-5r-mini/settings.md
 */

import {
  UV5R_MINI_ANI_OFFSET,
  UV5R_MINI_ANI_SIZE,
  UV5R_MINI_CHANNEL_SPAN,
  UV5R_MINI_DOWNCODE_OFFSET,
  UV5R_MINI_DOWNCODE_SIZE,
  UV5R_MINI_PTT_ID_OFFSET,
  UV5R_MINI_PTT_ID_SIZE,
  UV5R_MINI_SETTINGS_OFFSET,
  UV5R_MINI_SETTINGS_SIZE,
  UV5R_MINI_UPCODE_OFFSET,
  UV5R_MINI_UPCODE_SIZE,
  UV5R_MINI_VFO_A_OFFSET,
  UV5R_MINI_VFO_B_OFFSET,
  UV5R_MINI_VFO_SIZE,
} from './constants.ts';

export type Uv5rMiniWriteRole = 'replaced' | 'kept';

export type Uv5rMiniRegionId =
  | 'channels'
  | 'vfoA'
  | 'vfoB'
  | 'settings'
  | 'ani'
  | 'pttId'
  | 'upcode'
  | 'downcode';

export interface Uv5rMiniRegionManifestEntry {
  id: Uv5rMiniRegionId;
  label: string;
  packedOffset: number;
  sizeBytes: number;
  writeRole: Uv5rMiniWriteRole;
  /** Operator-facing copy for retain summary. */
  retainRoleCopy: string;
}

/** Operator-facing labels for replaced categories (Written from your build). */
export const UV5R_MINI_WRITTEN_FROM_BUILD_LABELS: readonly string[] = ['Channels'] as const;

const REPLACED_ROLE_COPY =
  'Replaced from your build on Write — the library is the source of truth for channels';
const KEPT_ROLE_COPY =
  'Kept from Read from radio — not changed when you write from your build';

/** All packed-image regions in address order. */
export const UV5R_MINI_REGION_MANIFEST: readonly Uv5rMiniRegionManifestEntry[] = [
  {
    id: 'channels',
    label: 'Channel memories',
    packedOffset: 0x0000,
    sizeBytes: UV5R_MINI_CHANNEL_SPAN,
    writeRole: 'replaced',
    retainRoleCopy: REPLACED_ROLE_COPY,
  },
  {
    id: 'vfoA',
    label: 'VFO A',
    packedOffset: UV5R_MINI_VFO_A_OFFSET,
    sizeBytes: UV5R_MINI_VFO_SIZE,
    writeRole: 'kept',
    retainRoleCopy: KEPT_ROLE_COPY,
  },
  {
    id: 'vfoB',
    label: 'VFO B',
    packedOffset: UV5R_MINI_VFO_B_OFFSET,
    sizeBytes: UV5R_MINI_VFO_SIZE,
    writeRole: 'kept',
    retainRoleCopy: KEPT_ROLE_COPY,
  },
  {
    id: 'settings',
    label: 'Radio settings',
    packedOffset: UV5R_MINI_SETTINGS_OFFSET,
    sizeBytes: UV5R_MINI_SETTINGS_SIZE,
    writeRole: 'kept',
    retainRoleCopy: KEPT_ROLE_COPY,
  },
  {
    id: 'ani',
    label: 'ANI',
    packedOffset: UV5R_MINI_ANI_OFFSET,
    sizeBytes: UV5R_MINI_ANI_SIZE,
    writeRole: 'kept',
    retainRoleCopy: KEPT_ROLE_COPY,
  },
  {
    id: 'pttId',
    label: 'PTT ID',
    packedOffset: UV5R_MINI_PTT_ID_OFFSET,
    sizeBytes: UV5R_MINI_PTT_ID_SIZE,
    writeRole: 'kept',
    retainRoleCopy: KEPT_ROLE_COPY,
  },
  {
    id: 'upcode',
    label: 'Upcode',
    packedOffset: UV5R_MINI_UPCODE_OFFSET,
    sizeBytes: UV5R_MINI_UPCODE_SIZE,
    writeRole: 'kept',
    retainRoleCopy: KEPT_ROLE_COPY,
  },
  {
    id: 'downcode',
    label: 'Downcode',
    packedOffset: UV5R_MINI_DOWNCODE_OFFSET,
    sizeBytes: UV5R_MINI_DOWNCODE_SIZE,
    writeRole: 'kept',
    retainRoleCopy: KEPT_ROLE_COPY,
  },
] as const;

export function uv5rMiniWriteRole(regionId: Uv5rMiniRegionId): Uv5rMiniWriteRole {
  const entry = UV5R_MINI_REGION_MANIFEST.find((r) => r.id === regionId);
  return entry?.writeRole ?? 'kept';
}

export function uv5rMiniRegionLabel(regionId: Uv5rMiniRegionId): string {
  const entry = UV5R_MINI_REGION_MANIFEST.find((r) => r.id === regionId);
  return entry?.label ?? 'Unknown region';
}

export function uv5rMiniKeptRegions(): readonly Uv5rMiniRegionManifestEntry[] {
  return UV5R_MINI_REGION_MANIFEST.filter((r) => r.writeRole === 'kept');
}
