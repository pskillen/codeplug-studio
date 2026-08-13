/**
 * AT-D890UV backup region roles — restorable vs inspect-only.
 *
 * Write-codeplug still treats optional settings / alarm as Read-only (never encoded
 * from a build). Restore **does** replay optional settings and APRS onto a fresh live
 * erase-unit read. LocalInfo, alarm forensics, unnamed leftover, and the family
 * safe-skip address are never restored.
 */

import type { RadioBackupRegionRole } from '../../backup/types.ts';
import { AT_D890_LIMITS, AT_D890_SAFE_SKIP_WRITE_ADDR, D890_MAP } from './constants.ts';

export interface AtD890BackupRegionSpan {
  id: string;
  label: string;
  start: number;
  length: number;
  restoreRole: RadioBackupRegionRole;
}

function bitmapSlots(setBytes: number): number {
  return setBytes * 8;
}

const ZONE_SLOTS = bitmapSlots(AT_D890_LIMITS.ZONE_SET_BYTES);
const SCAN_SLOTS = bitmapSlots(AT_D890_LIMITS.SCAN_LIST_SET_BYTES);
const RADIO_ID_SLOTS = bitmapSlots(AT_D890_LIMITS.RADIO_ID_SET_BYTES);
const RX_GROUP_SLOTS = bitmapSlots(AT_D890_LIMITS.RX_GROUP_SET_BYTES);

/**
 * Named spans derived from `D890_MAP` / sparse download stages.
 * Inspect-only: LocalInfo, alarm, leftover. Restorable: codeplug-shaped banks
 * including optional settings and APRS.
 */
export const AT_D890_BACKUP_REGION_SPANS: readonly AtD890BackupRegionSpan[] = [
  {
    id: 'local-info',
    label: 'LocalInfo',
    start: D890_MAP.LocalInfo,
    length: D890_MAP.LocalInfoLength,
    restoreRole: 'inspect-only',
  },
  {
    id: 'alarm-bitmap',
    label: 'Alarm bitmap',
    start: D890_MAP.AlarmBitmap,
    length: D890_MAP.AlarmBitmapLength,
    restoreRole: 'inspect-only',
  },
  {
    id: 'alarm-data',
    label: 'Alarm data',
    start: D890_MAP.AlarmData,
    length: D890_MAP.AlarmDataLength,
    restoreRole: 'inspect-only',
  },
  {
    id: 'optional-settings-main',
    label: 'Optional settings (main)',
    start: D890_MAP.OptionalSettingsMain,
    length: D890_MAP.OptionalSettingsMainLength,
    restoreRole: 'restorable',
  },
  {
    id: 'optional-settings-ext',
    label: 'Optional settings (ext)',
    start: D890_MAP.OptionalSettingsExt,
    length: D890_MAP.OptionalSettingsExtLength,
    restoreRole: 'restorable',
  },
  {
    id: 'optional-settings-aprs',
    label: 'Optional settings (GPS info)',
    start: D890_MAP.OptionalSettingsAprs,
    length: D890_MAP.OptionalSettingsAprsLength,
    restoreRole: 'restorable',
  },
  {
    id: 'aprs-config',
    label: 'APRS config',
    start: D890_MAP.AprsConfigMain,
    length: D890_MAP.AprsConfigMainLength,
    restoreRole: 'restorable',
  },
  {
    id: 'aprs-receive-filters',
    label: 'APRS receive filters',
    start: D890_MAP.AprsReceiveFilters,
    length: D890_MAP.AprsReceiveFiltersLength,
    restoreRole: 'restorable',
  },
  {
    id: 'channel-set',
    label: 'Channels (bitmap)',
    start: D890_MAP.ChannelSet,
    length: AT_D890_LIMITS.CHANNEL_SET_BYTES,
    restoreRole: 'restorable',
  },
  {
    id: 'channel-data',
    label: 'Channels',
    start: D890_MAP.ChannelData,
    length: D890_MAP.ChannelDataBlockCount * D890_MAP.ChannelDataBlockOffset,
    restoreRole: 'restorable',
  },
  {
    id: 'zone-set',
    label: 'Zones (bitmap)',
    start: D890_MAP.ZoneSet,
    length: AT_D890_LIMITS.ZONE_SET_BYTES,
    restoreRole: 'restorable',
  },
  {
    id: 'zone-hide',
    label: 'Zone hide',
    start: D890_MAP.ZoneHide,
    length: AT_D890_LIMITS.ZONE_SET_BYTES,
    restoreRole: 'restorable',
  },
  {
    id: 'zone-names',
    label: 'Zone names',
    start: D890_MAP.ZonesName,
    length: D890_MAP.ZoneDataOffset * ZONE_SLOTS,
    restoreRole: 'restorable',
  },
  {
    id: 'zone-channels',
    label: 'Zone members',
    start: D890_MAP.ZoneChannels,
    length: D890_MAP.ZoneChannelsStride * ZONE_SLOTS,
    restoreRole: 'restorable',
  },
  {
    id: 'zone-a-channel',
    label: 'Zone A channel',
    start: D890_MAP.ZoneAChannel,
    length: D890_MAP.ZoneTableBytes,
    restoreRole: 'restorable',
  },
  {
    id: 'zone-b-channel',
    label: 'Zone B channel',
    start: D890_MAP.ZoneBChannel,
    length: D890_MAP.ZoneTableBytes,
    restoreRole: 'restorable',
  },
  {
    id: 'scan-list-set',
    label: 'Scan lists (bitmap)',
    start: D890_MAP.ScanListSet,
    length: AT_D890_LIMITS.SCAN_LIST_SET_BYTES,
    restoreRole: 'restorable',
  },
  {
    id: 'scan-list-data',
    label: 'Scan lists',
    start: D890_MAP.ScanListData,
    length: D890_MAP.ScanListStride * SCAN_SLOTS,
    restoreRole: 'restorable',
  },
  {
    id: 'talkgroup-set',
    label: 'Talk groups (bitmap)',
    start: D890_MAP.TalkgroupSet,
    length: AT_D890_LIMITS.TALKGROUP_SET_BYTES,
    restoreRole: 'restorable',
  },
  {
    id: 'talkgroup-data',
    label: 'Talk groups',
    start: D890_MAP.TalkgroupData,
    length: D890_MAP.TalkgroupOrder - D890_MAP.TalkgroupData,
    restoreRole: 'restorable',
  },
  {
    id: 'talkgroup-order',
    label: 'Talk group order',
    start: D890_MAP.TalkgroupOrder,
    length: 0x1000,
    restoreRole: 'restorable',
  },
  {
    id: 'rx-group-set',
    label: 'RX lists (bitmap)',
    start: D890_MAP.ReceiveGroupSet,
    length: AT_D890_LIMITS.RX_GROUP_SET_BYTES,
    restoreRole: 'restorable',
  },
  {
    id: 'rx-group-data',
    label: 'RX lists',
    start: D890_MAP.ReceiveGroupData,
    length: D890_MAP.ReceiveGroupStride * RX_GROUP_SLOTS,
    restoreRole: 'restorable',
  },
  {
    id: 'radio-id-set',
    label: 'Radio IDs (bitmap)',
    start: D890_MAP.RadioIdSet,
    length: AT_D890_LIMITS.RADIO_ID_SET_BYTES,
    restoreRole: 'restorable',
  },
  {
    id: 'radio-id-data',
    label: 'Radio IDs',
    start: D890_MAP.RadioIdData,
    length: D890_MAP.RadioIdStride * RADIO_ID_SLOTS,
    restoreRole: 'restorable',
  },
  {
    id: 'master-id',
    label: 'Master radio ID',
    start: D890_MAP.MasterIdData,
    length: D890_MAP.MasterIdLength,
    restoreRole: 'restorable',
  },
  {
    id: 'am-air-set',
    label: 'AM airband (bitmap)',
    start: D890_MAP.AmAirSet,
    length: D890_MAP.AmAirSetLength,
    restoreRole: 'restorable',
  },
  {
    id: 'am-air-data',
    label: 'AM airband',
    start: D890_MAP.AmAirData,
    length: D890_MAP.AmAirDataStride * D890_MAP.AmAirCount,
    restoreRole: 'restorable',
  },
  {
    id: 'am-air-vfo',
    label: 'AM airband VFO',
    start: D890_MAP.AmAirVfo,
    length: D890_MAP.AmAirVfoLength,
    restoreRole: 'restorable',
  },
  {
    id: 'am-zone-set',
    label: 'AM zones (bitmap)',
    start: D890_MAP.AmZoneSet,
    length: D890_MAP.AmZoneSetLength,
    restoreRole: 'restorable',
  },
  {
    id: 'am-zone-a-channel',
    label: 'AM zone A channel',
    start: D890_MAP.AmZoneAChannel,
    length: D890_MAP.AmZoneAChannelLength,
    restoreRole: 'restorable',
  },
  {
    id: 'am-zone-scan',
    label: 'AM zone scan',
    start: D890_MAP.AmZoneScan,
    length: D890_MAP.AmZoneScanLength,
    restoreRole: 'restorable',
  },
  {
    id: 'am-zone-data',
    label: 'AM zones',
    start: D890_MAP.AmZoneData,
    length: D890_MAP.AmZoneDataStride * D890_MAP.AmZoneCount,
    restoreRole: 'restorable',
  },
];

function spansOverlap(startA: number, lengthA: number, startB: number, lengthB: number): boolean {
  return startA < startB + lengthB && startA + lengthA > startB;
}

function addressInSpan(address: number, span: AtD890BackupRegionSpan): boolean {
  return address >= span.start && address < span.start + span.length;
}

/** Longest matching named span (handles nested/adjacent banks). */
export function atD890BackupSpanForAddress(address: number): AtD890BackupRegionSpan | undefined {
  let best: AtD890BackupRegionSpan | undefined;
  for (const span of AT_D890_BACKUP_REGION_SPANS) {
    if (!addressInSpan(address, span)) continue;
    if (!best || span.length < best.length) best = span;
  }
  return best;
}

export function atD890BackupRestoreRole(address: number, length = 1): RadioBackupRegionRole {
  if (length <= 0) return 'inspect-only';
  const end = address + length;
  if (address <= AT_D890_SAFE_SKIP_WRITE_ADDR && AT_D890_SAFE_SKIP_WRITE_ADDR < end) {
    return 'inspect-only';
  }
  const hit = AT_D890_BACKUP_REGION_SPANS.filter((span) =>
    spansOverlap(address, length, span.start, span.length),
  );
  if (hit.length === 0) return 'inspect-only';
  if (hit.some((span) => span.restoreRole === 'inspect-only')) return 'inspect-only';
  return 'restorable';
}

export function isAtD890RestoreNeverWriteAddress(address: number): boolean {
  if (address === AT_D890_SAFE_SKIP_WRITE_ADDR) return true;
  const span = atD890BackupSpanForAddress(address);
  return span?.restoreRole === 'inspect-only';
}
