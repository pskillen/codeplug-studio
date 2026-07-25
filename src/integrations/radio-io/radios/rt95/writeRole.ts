/**
 * RT95 write-role manifest — Written vs Kept on Web Serial Write.
 */

import {
  RT95_BANDLIMIT_OFFSET,
  RT95_CHANNEL_SPAN,
  RT95_OCCUPIED_BITFIELD_OFFSET,
  RT95_SCAN_BITFIELD_OFFSET,
  RT95_IMAGE_SIZE,
} from './constants.ts';

export type Rt95WriteRole = 'replaced' | 'kept';

export const RT95_WRITTEN_FROM_BUILD_LABELS: readonly string[] = [
  'Channels (200 slots)',
  'Occupancy and scan bitfields',
] as const;

export interface Rt95RegionManifestEntry {
  id: string;
  label: string;
  offset: number;
  length: number;
  role: Rt95WriteRole;
}

export const RT95_REGION_MANIFEST: readonly Rt95RegionManifestEntry[] = [
  {
    id: 'channels',
    label: 'Channel records',
    offset: 0x0000,
    length: RT95_CHANNEL_SPAN,
    role: 'replaced',
  },
  {
    id: 'bitfields',
    label: 'Occupancy / scan bitfields',
    offset: RT95_OCCUPIED_BITFIELD_OFFSET,
    length: RT95_SCAN_BITFIELD_OFFSET + 32 - RT95_OCCUPIED_BITFIELD_OFFSET,
    role: 'replaced',
  },
  {
    id: 'display',
    label: 'Starting display',
    offset: 0x1980,
    length: 0x10,
    role: 'kept',
  },
  {
    id: 'pttid',
    label: 'PTT-ID encode',
    offset: 0x1990,
    length: 0x100,
    role: 'kept',
  },
  {
    id: 'dtmf',
    label: 'DTMF / remote codes',
    offset: 0x1a90,
    length: 0x3200 - 0x1a90,
    role: 'kept',
  },
  {
    id: 'settings',
    label: 'Radio settings',
    offset: 0x3200,
    length: 0x3240 - 0x3200,
    role: 'kept',
  },
  {
    id: 'password',
    label: 'Power-on password',
    offset: 0x3240,
    length: 0x10,
    role: 'kept',
  },
  {
    id: 'pfkeys',
    label: 'PF keys',
    offset: 0x3250,
    length: 0x10,
    role: 'kept',
  },
  {
    id: 'radio_settings',
    label: 'Radio settings (MR/VFO/bandlimit)',
    offset: 0x3260,
    length: RT95_IMAGE_SIZE - 0x3260,
    role: 'kept',
  },
] as const;

export function rt95WriteRole(offset: number): Rt95WriteRole {
  for (const region of RT95_REGION_MANIFEST) {
    if (offset >= region.offset && offset < region.offset + region.length) {
      return region.role;
    }
  }
  return 'kept';
}

export function rt95RegionLabel(offset: number): string {
  for (const region of RT95_REGION_MANIFEST) {
    if (offset >= region.offset && offset < region.offset + region.length) {
      return region.label;
    }
  }
  return 'Unknown region';
}

export function rt95KeptRegions(): readonly Rt95RegionManifestEntry[] {
  return RT95_REGION_MANIFEST.filter((r) => r.role === 'kept');
}

export function rt95BandlimitOffset(): number {
  return RT95_BANDLIMIT_OFFSET;
}
