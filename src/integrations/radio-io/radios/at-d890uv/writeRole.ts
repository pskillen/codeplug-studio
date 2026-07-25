/**
 * AT-D890UV write-role manifest — encode vs retain for sparse regions.
 */

import { D890_MAP } from './constants.ts';

export type AtD890WriteRole = 'replaced' | 'kept';

export const AT_D890_WRITTEN_FROM_BUILD_LABELS: readonly string[] = [
  'Channels',
  'Zones',
  'Scan lists',
  'Talk groups',
  'RX group lists',
  'Operator radio IDs',
  'Master radio ID',
] as const;

export const AT_D890_DIGITAL_CONTACTS_WRITE_GAP =
  'Digital contacts, boot images, and analog address book stay as they were on the radio when you Write. Export Anytone CSV for CPS if you need to update those.';

const REPLACED_REGIONS = new Set<number>([
  D890_MAP.ChannelSet,
  D890_MAP.ZoneSet,
  D890_MAP.ZoneHide,
  D890_MAP.ZoneAChannel,
  D890_MAP.ZoneBChannel,
  D890_MAP.RadioIdSet,
  D890_MAP.ScanListSet,
  D890_MAP.TalkgroupSet,
  D890_MAP.ReceiveGroupSet,
  D890_MAP.MasterIdData,
]);

export function atD890RegionLabel(address: number): string {
  if (address === D890_MAP.LocalInfo) return 'Local info';
  if (address === D890_MAP.ChannelSet) return 'Channel bitmap';
  if (address >= D890_MAP.ChannelData && address < D890_MAP.ChannelData + 0x100_0000) {
    return 'Channel data';
  }
  if (address === D890_MAP.ZoneSet) return 'Zone bitmap';
  if (address === D890_MAP.ZoneHide) return 'Zone hide';
  if (address === D890_MAP.ZoneAChannel || address === D890_MAP.ZoneBChannel) {
    return 'Zone A/B tables';
  }
  if (address >= D890_MAP.ZonesName && address < D890_MAP.ZoneChannels) return 'Zone names';
  if (address >= D890_MAP.ZoneChannels && address < D890_MAP.ZoneAChannel) return 'Zone membership';
  if (address === D890_MAP.RadioIdSet) return 'Operator radio ID bitmap';
  if (address >= D890_MAP.RadioIdData && address < D890_MAP.ScanListData) {
    return 'Operator radio IDs';
  }
  if (address === D890_MAP.ScanListSet) return 'Scan list bitmap';
  if (address >= D890_MAP.ScanListData && address < D890_MAP.TalkgroupSet) return 'Scan lists';
  if (address === D890_MAP.TalkgroupSet) return 'Talk group bitmap';
  if (address >= D890_MAP.TalkgroupData && address < D890_MAP.ReceiveGroupSet) {
    return 'Talk groups';
  }
  if (address === D890_MAP.ReceiveGroupSet) return 'RX group bitmap';
  if (address >= D890_MAP.ReceiveGroupData && address < D890_MAP.MasterIdData) {
    return 'RX group lists';
  }
  if (address === D890_MAP.MasterIdData) return 'Master radio ID';
  return 'Other retained region';
}

export function atD890WriteRole(address: number): AtD890WriteRole {
  if (REPLACED_REGIONS.has(address)) return 'replaced';
  if (address >= D890_MAP.ChannelData && address < D890_MAP.ChannelData + 0x100_0000) {
    return 'replaced';
  }
  if (address >= D890_MAP.ZonesName && address < D890_MAP.ZoneAChannel) return 'replaced';
  if (address >= D890_MAP.ZoneChannels && address < D890_MAP.ZoneAChannel) return 'replaced';
  if (address >= D890_MAP.RadioIdData && address < D890_MAP.ScanListData) return 'replaced';
  if (address >= D890_MAP.ScanListData && address < D890_MAP.TalkgroupSet) return 'replaced';
  if (address >= D890_MAP.TalkgroupData && address < D890_MAP.ReceiveGroupSet) return 'replaced';
  if (address >= D890_MAP.ReceiveGroupData && address < D890_MAP.MasterIdData) return 'replaced';
  return 'kept';
}
