/**
 * AT-D890UV write-role manifest — encode vs retain for sparse regions.
 *
 * D890_MAP is sparse and **non-monotonic** — never classify by comparing one
 * region base to an unrelated region base (e.g. TalkgroupData vs ReceiveGroupSet).
 * Use explicit bank spans from each region's own base + stride × capacity.
 */

import { AT_D890_LIMITS, D890_MAP } from './constants.ts';

export type AtD890WriteRole = 'replaced' | 'kept';

export const AT_D890_WRITTEN_FROM_BUILD_LABELS: readonly string[] = [
  'Channels',
  'Zones',
  'Scan lists',
  'Talk groups',
  'RX group lists',
  'Operator radio IDs',
  'Master radio ID',
  'AM airband channels',
  'AM airband zones',
] as const;

export const AT_D890_DIGITAL_CONTACTS_WRITE_GAP =
  'Digital contacts, boot images, and analog address book stay as they were on the radio when you Write. Export Anytone CSV for CPS if you need to update those.';

/** Bitmap byte length → slot capacity (1 bit per slot). */
function bitmapSlotCount(setBytes: number): number {
  return setBytes * 8;
}

function inExclusiveSpan(address: number, base: number, length: number): boolean {
  return address >= base && address < base + length;
}

function inBank(address: number, base: number, stride: number, slotCount: number): boolean {
  return inExclusiveSpan(address, base, stride * slotCount);
}

const ZONE_SLOTS = bitmapSlotCount(AT_D890_LIMITS.ZONE_SET_BYTES);
const SCAN_SLOTS = bitmapSlotCount(AT_D890_LIMITS.SCAN_LIST_SET_BYTES);
const RADIO_ID_SLOTS = bitmapSlotCount(AT_D890_LIMITS.RADIO_ID_SET_BYTES);
const RX_GROUP_SLOTS = bitmapSlotCount(AT_D890_LIMITS.RX_GROUP_SET_BYTES);
const TALKGROUP_SLOTS = bitmapSlotCount(AT_D890_LIMITS.TALKGROUP_SET_BYTES);

/** Channel primary/secondary halves live under ChannelData … ChannelData+0x1000000. */
const CHANNEL_DATA_SPAN = 0x100_0000;

const FIXED_REPLACED = new Set<number>([
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
  D890_MAP.TalkgroupOrder,
  D890_MAP.AmAirSet,
  D890_MAP.AmZoneSet,
  D890_MAP.AmZoneAChannel,
  D890_MAP.AmZoneScan,
]);

export function atD890RegionLabel(address: number): string {
  if (inExclusiveSpan(address, D890_MAP.LocalInfo, D890_MAP.LocalInfoLength)) {
    return 'Local info';
  }
  if (address === D890_MAP.ChannelSet) return 'Channel bitmap';
  if (inExclusiveSpan(address, D890_MAP.ChannelData, CHANNEL_DATA_SPAN)) {
    return 'Channel data';
  }
  if (address === D890_MAP.ZoneSet) return 'Zone bitmap';
  if (address === D890_MAP.ZoneHide) return 'Zone hide';
  if (address === D890_MAP.ZoneAChannel || address === D890_MAP.ZoneBChannel) {
    return 'Zone A/B tables';
  }
  if (inBank(address, D890_MAP.ZonesName, D890_MAP.ZoneDataOffset, ZONE_SLOTS)) {
    return 'Zone names';
  }
  if (inBank(address, D890_MAP.ZoneChannels, D890_MAP.ZoneChannelsStride, ZONE_SLOTS)) {
    return 'Zone membership';
  }
  if (address === D890_MAP.RadioIdSet) return 'Operator radio ID bitmap';
  if (inBank(address, D890_MAP.RadioIdData, D890_MAP.RadioIdStride, RADIO_ID_SLOTS)) {
    return 'Operator radio IDs';
  }
  if (address === D890_MAP.ScanListSet) return 'Scan list bitmap';
  if (inBank(address, D890_MAP.ScanListData, D890_MAP.ScanListStride, SCAN_SLOTS)) {
    return 'Scan lists';
  }
  if (address === D890_MAP.TalkgroupSet) return 'Talk group bitmap';
  if (inBank(address, D890_MAP.TalkgroupData, D890_MAP.TalkgroupStride, TALKGROUP_SLOTS)) {
    return 'Talk groups';
  }
  if (address === D890_MAP.TalkgroupOrder) return 'Talk group order';
  if (address === D890_MAP.ReceiveGroupSet) return 'RX group bitmap';
  if (inBank(address, D890_MAP.ReceiveGroupData, D890_MAP.ReceiveGroupStride, RX_GROUP_SLOTS)) {
    return 'RX group lists';
  }
  if (address === D890_MAP.MasterIdData) return 'Master radio ID';
  if (address === D890_MAP.AmAirSet) return 'AM airband bitmap';
  if (inExclusiveSpan(address, D890_MAP.AmAirVfo, D890_MAP.AmAirVfoLength)) {
    return 'AM airband VFO';
  }
  if (inBank(address, D890_MAP.AmAirData, D890_MAP.AmAirDataStride, D890_MAP.AmAirCount)) {
    return 'AM airband channels';
  }
  if (address === D890_MAP.AmZoneSet) return 'AM airband zone bitmap';
  if (inExclusiveSpan(address, D890_MAP.AmZoneAChannel, D890_MAP.AmZoneAChannelLength)) {
    return 'AM airband zone A-channel';
  }
  if (inExclusiveSpan(address, D890_MAP.AmZoneScan, D890_MAP.AmZoneScanLength)) {
    return 'AM airband zone scan';
  }
  if (inBank(address, D890_MAP.AmZoneData, D890_MAP.AmZoneDataStride, D890_MAP.AmZoneCount)) {
    return 'AM airband zones';
  }
  return 'Other retained region';
}

export function atD890WriteRole(address: number): AtD890WriteRole {
  if (FIXED_REPLACED.has(address)) return 'replaced';
  if (inExclusiveSpan(address, D890_MAP.ChannelData, CHANNEL_DATA_SPAN)) return 'replaced';
  if (inBank(address, D890_MAP.ZonesName, D890_MAP.ZoneDataOffset, ZONE_SLOTS)) {
    return 'replaced';
  }
  if (inBank(address, D890_MAP.ZoneChannels, D890_MAP.ZoneChannelsStride, ZONE_SLOTS)) {
    return 'replaced';
  }
  if (inBank(address, D890_MAP.RadioIdData, D890_MAP.RadioIdStride, RADIO_ID_SLOTS)) {
    return 'replaced';
  }
  if (inBank(address, D890_MAP.ScanListData, D890_MAP.ScanListStride, SCAN_SLOTS)) {
    return 'replaced';
  }
  if (inBank(address, D890_MAP.TalkgroupData, D890_MAP.TalkgroupStride, TALKGROUP_SLOTS)) {
    return 'replaced';
  }
  if (address === D890_MAP.TalkgroupOrder) return 'replaced';
  if (inBank(address, D890_MAP.ReceiveGroupData, D890_MAP.ReceiveGroupStride, RX_GROUP_SLOTS)) {
    return 'replaced';
  }
  if (inBank(address, D890_MAP.AmAirData, D890_MAP.AmAirDataStride, D890_MAP.AmAirCount)) {
    return 'replaced';
  }
  if (inBank(address, D890_MAP.AmZoneData, D890_MAP.AmZoneDataStride, D890_MAP.AmZoneCount)) {
    return 'replaced';
  }
  return 'kept';
}
