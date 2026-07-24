/**
 * OpenGD77 / OpenUV380 write-role manifest — encode vs retain regions.
 * Cite: docs/reference/radios/opengd77/memory-layout.md
 */

import { OPENUV380_OFFSET } from './constants.ts';

export type OpenGd77WriteRole = 'replaced' | 'kept';

export type OpenGd77RegionId =
  | 'channels'
  | 'zones'
  | 'contacts'
  | 'groupLists'
  | 'settings'
  | 'dtmfSettings'
  | 'aprsSettings'
  | 'dtmfContacts'
  | 'bootSettings'
  | 'vfoA'
  | 'vfoB'
  | 'additionalSettings';

export interface OpenGd77RegionManifestEntry {
  id: OpenGd77RegionId;
  label: string;
  absAddress: number;
  writeRole: OpenGd77WriteRole;
  retainRoleCopy: string;
}

export const OPENGD77_WRITTEN_FROM_BUILD_LABELS: readonly string[] = [
  'Channels',
  'Zones',
  'DMR contacts',
  'RX group lists',
] as const;

export const OPENGD77_DTMF_CONTACTS_WRITE_GAP =
  'DTMF contacts stay as they were on the radio when you Write. Use OpenGD77 CPS CSV export if you need to update those.';

export const OPENGD77_APRS_WRITE_GAP =
  'FM APRS systems stay as they were on the radio when you Write. Use OpenGD77 CPS CSV export if you need to update those.';

const REPLACED =
  'Replaced from your build on Write — the library is the source of truth for this region';
const KEPT = 'Kept from Read from radio — not changed when you write from your build';

export const OPENGD77_REGION_MANIFEST: readonly OpenGd77RegionManifestEntry[] = [
  {
    id: 'settings',
    label: 'General settings',
    absAddress: OPENUV380_OFFSET.settings,
    writeRole: 'kept',
    retainRoleCopy: KEPT,
  },
  {
    id: 'dtmfSettings',
    label: 'DTMF settings',
    absAddress: OPENUV380_OFFSET.dtmfSettings,
    writeRole: 'kept',
    retainRoleCopy: KEPT,
  },
  {
    id: 'aprsSettings',
    label: 'FM APRS systems',
    absAddress: OPENUV380_OFFSET.aprsSettings,
    writeRole: 'kept',
    retainRoleCopy: KEPT,
  },
  {
    id: 'dtmfContacts',
    label: 'DTMF contacts',
    absAddress: OPENUV380_OFFSET.dtmfContacts,
    writeRole: 'kept',
    retainRoleCopy: KEPT,
  },
  {
    id: 'channels',
    label: 'Channel memories',
    absAddress: OPENUV380_OFFSET.channelBank0,
    writeRole: 'replaced',
    retainRoleCopy: REPLACED,
  },
  {
    id: 'bootSettings',
    label: 'Boot settings',
    absAddress: OPENUV380_OFFSET.bootSettings,
    writeRole: 'kept',
    retainRoleCopy: KEPT,
  },
  {
    id: 'vfoA',
    label: 'VFO A',
    absAddress: OPENUV380_OFFSET.vfoA,
    writeRole: 'kept',
    retainRoleCopy: KEPT,
  },
  {
    id: 'vfoB',
    label: 'VFO B',
    absAddress: OPENUV380_OFFSET.vfoB,
    writeRole: 'kept',
    retainRoleCopy: KEPT,
  },
  {
    id: 'zones',
    label: 'Zones',
    absAddress: OPENUV380_OFFSET.zoneBank,
    writeRole: 'replaced',
    retainRoleCopy: REPLACED,
  },
  {
    id: 'additionalSettings',
    label: 'Additional settings',
    absAddress: OPENUV380_OFFSET.additionalSettings,
    writeRole: 'kept',
    retainRoleCopy: KEPT,
  },
  {
    id: 'contacts',
    label: 'DMR contacts',
    absAddress: OPENUV380_OFFSET.contacts,
    writeRole: 'replaced',
    retainRoleCopy: REPLACED,
  },
  {
    id: 'groupLists',
    label: 'RX group lists',
    absAddress: OPENUV380_OFFSET.groupLists,
    writeRole: 'replaced',
    retainRoleCopy: REPLACED,
  },
];

export function openGd77KeptRegions(): readonly OpenGd77RegionManifestEntry[] {
  return OPENGD77_REGION_MANIFEST.filter((r) => r.writeRole === 'kept');
}

export function openGd77ReplacedRegions(): readonly OpenGd77RegionManifestEntry[] {
  return OPENGD77_REGION_MANIFEST.filter((r) => r.writeRole === 'replaced');
}
