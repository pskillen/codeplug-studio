/**
 * UV-17Pro family write-role manifest — single source of truth for encode vs retain.
 */

import type { Uv17ProLayout } from './layout.ts';

export type Uv17ProWriteRole = 'replaced' | 'kept';

export interface Uv17ProRegionManifestEntry {
  id: string;
  label: string;
  packedOffset: number;
  sizeBytes: number;
  writeRole: Uv17ProWriteRole;
  retainRoleCopy: string;
}

export const UV17PRO_WRITTEN_FROM_BUILD_LABELS: readonly string[] = ['Channels'] as const;

const REPLACED_ROLE_COPY =
  'Replaced from your build on Write — the full channel span is cleared then encoded from your library; unlisted slots become empty';
const KEPT_ROLE_COPY = 'Kept from Read from radio — not changed when you write from your build';

export function buildUv17ProRegionManifest(
  layout: Uv17ProLayout,
): readonly Uv17ProRegionManifestEntry[] {
  const kept: Uv17ProRegionManifestEntry[] = [
    {
      id: 'vfoA',
      label: 'VFO A',
      packedOffset: layout.vfoAOffset,
      sizeBytes: layout.vfoSize,
      writeRole: 'kept',
      retainRoleCopy: KEPT_ROLE_COPY,
    },
    {
      id: 'vfoB',
      label: 'VFO B',
      packedOffset: layout.vfoBOffset,
      sizeBytes: layout.vfoSize,
      writeRole: 'kept',
      retainRoleCopy: KEPT_ROLE_COPY,
    },
    {
      id: 'settings',
      label: 'Radio settings',
      packedOffset: layout.settingsOffset,
      sizeBytes: layout.settingsSize,
      writeRole: 'kept',
      retainRoleCopy: KEPT_ROLE_COPY,
    },
    {
      id: 'ani',
      label: 'ANI',
      packedOffset: layout.aniOffset,
      sizeBytes: layout.aniSize,
      writeRole: 'kept',
      retainRoleCopy: KEPT_ROLE_COPY,
    },
    {
      id: 'pttId',
      label: 'PTT ID',
      packedOffset: layout.pttIdOffset,
      sizeBytes: layout.pttIdSize,
      writeRole: 'kept',
      retainRoleCopy: KEPT_ROLE_COPY,
    },
    {
      id: 'upcode',
      label: 'Upcode',
      packedOffset: layout.upcodeOffset,
      sizeBytes: layout.upcodeSize,
      writeRole: 'kept',
      retainRoleCopy: KEPT_ROLE_COPY,
    },
    {
      id: 'downcode',
      label: 'Downcode',
      packedOffset: layout.downcodeOffset,
      sizeBytes: layout.downcodeSize,
      writeRole: 'kept',
      retainRoleCopy: KEPT_ROLE_COPY,
    },
    ...layout.extraKeptRegions.map((r) => ({
      id: r.id,
      label: r.label,
      packedOffset: r.packedOffset,
      sizeBytes: r.sizeBytes,
      writeRole: 'kept' as const,
      retainRoleCopy: KEPT_ROLE_COPY,
    })),
  ];

  return [
    {
      id: 'channels',
      label: 'Channel memories',
      packedOffset: 0x0000,
      sizeBytes: layout.channelSpan,
      writeRole: 'replaced',
      retainRoleCopy: REPLACED_ROLE_COPY,
    },
    ...kept,
  ];
}

export function uv17ProKeptRegions(layout: Uv17ProLayout): readonly Uv17ProRegionManifestEntry[] {
  return buildUv17ProRegionManifest(layout).filter((r) => r.writeRole === 'kept');
}

export function uv17ProWriteRole(layout: Uv17ProLayout, regionId: string): Uv17ProWriteRole {
  const entry = buildUv17ProRegionManifest(layout).find((r) => r.id === regionId);
  return entry?.writeRole ?? 'kept';
}
