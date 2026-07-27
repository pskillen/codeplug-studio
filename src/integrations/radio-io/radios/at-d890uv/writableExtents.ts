/**
 * AT-D890UV serial write allow-list (WATCH-08).
 * Modelled banks define what Studio may **change**; sparse erase-unit RMW may
 * **transmit** unchanged bytes inside touched units to survive flash erase.
 */

import { RadioProtocolError } from '../../kit/errors.ts';
import {
  isAtD890ChannelDataAddress,
  isAtD890ChannelDataRealAddress,
} from './channelDataGeometry.ts';
import { eraseUnitBaseFor } from './eraseUnits.ts';
import { AT_D890_LIMITS, AT_D890_SAFE_SKIP_WRITE_ADDR, D890_MAP } from './constants.ts';

export interface AtD890MemoryExtent {
  id: string;
  start: number;
  length: number;
}

function bitmapSlotCount(setBytes: number): number {
  return setBytes * 8;
}

const ZONE_SLOTS = bitmapSlotCount(AT_D890_LIMITS.ZONE_SET_BYTES);
const SCAN_SLOTS = bitmapSlotCount(AT_D890_LIMITS.SCAN_LIST_SET_BYTES);
const RADIO_ID_SLOTS = bitmapSlotCount(AT_D890_LIMITS.RADIO_ID_SET_BYTES);
const RX_GROUP_SLOTS = bitmapSlotCount(AT_D890_LIMITS.RX_GROUP_SET_BYTES);

function buildChannelDataWritableExtents(): AtD890MemoryExtent[] {
  return Array.from({ length: D890_MAP.ChannelDataBlockCount }, (_, blockIndex) => ({
    id: `ChannelData.block${blockIndex}`,
    start: D890_MAP.ChannelData + blockIndex * D890_MAP.ChannelDataBlockOffset,
    length: D890_MAP.ChannelDataBackedBytes,
  }));
}

const CHANNEL_DATA_WRITABLE_EXTENTS = buildChannelDataWritableExtents();

/** Modelled banks Studio may serial-write (positive allow-list). */
export const AT_D890_WRITABLE_EXTENTS: readonly AtD890MemoryExtent[] = [
  { id: 'ChannelSet', start: D890_MAP.ChannelSet, length: AT_D890_LIMITS.CHANNEL_SET_BYTES },
  ...CHANNEL_DATA_WRITABLE_EXTENTS,
  { id: 'ZoneSet', start: D890_MAP.ZoneSet, length: AT_D890_LIMITS.ZONE_SET_BYTES },
  { id: 'ZoneHide', start: D890_MAP.ZoneHide, length: AT_D890_LIMITS.ZONE_SET_BYTES },
  { id: 'ZoneAChannel', start: D890_MAP.ZoneAChannel, length: D890_MAP.ZoneTableBytes },
  { id: 'ZoneBChannel', start: D890_MAP.ZoneBChannel, length: D890_MAP.ZoneTableBytes },
  {
    id: 'ZonesName',
    start: D890_MAP.ZonesName,
    length: D890_MAP.ZoneDataOffset * ZONE_SLOTS,
  },
  {
    id: 'ZoneChannels',
    start: D890_MAP.ZoneChannels,
    length: D890_MAP.ZoneChannelsStride * ZONE_SLOTS,
  },
  { id: 'ScanListSet', start: D890_MAP.ScanListSet, length: AT_D890_LIMITS.SCAN_LIST_SET_BYTES },
  {
    id: 'ScanListData',
    start: D890_MAP.ScanListData,
    length: D890_MAP.ScanListStride * SCAN_SLOTS,
  },
  {
    id: 'TalkgroupSet',
    start: D890_MAP.TalkgroupSet,
    length: AT_D890_LIMITS.TALKGROUP_SET_BYTES,
  },
  {
    id: 'TalkgroupData',
    start: D890_MAP.TalkgroupData,
    length: D890_MAP.TalkgroupOrder - D890_MAP.TalkgroupData,
  },
  { id: 'TalkgroupOrder', start: D890_MAP.TalkgroupOrder, length: 0x1000 },
  {
    id: 'ReceiveGroupSet',
    start: D890_MAP.ReceiveGroupSet,
    length: AT_D890_LIMITS.RX_GROUP_SET_BYTES,
  },
  {
    id: 'ReceiveGroupData',
    start: D890_MAP.ReceiveGroupData,
    length: D890_MAP.ReceiveGroupStride * RX_GROUP_SLOTS,
  },
  { id: 'RadioIdSet', start: D890_MAP.RadioIdSet, length: AT_D890_LIMITS.RADIO_ID_SET_BYTES },
  {
    id: 'RadioIdData',
    start: D890_MAP.RadioIdData,
    length: D890_MAP.RadioIdStride * RADIO_ID_SLOTS,
  },
  { id: 'MasterIdData', start: D890_MAP.MasterIdData, length: D890_MAP.MasterIdLength },
] as const;

/** Never serial-written — pre-Write plausibility spans (refuse all-0xff). */
export const AT_D890_SENTINEL_EXTENTS: readonly AtD890MemoryExtent[] = [
  { id: 'LocalInfo', start: D890_MAP.LocalInfo, length: D890_MAP.LocalInfoLength },
  { id: 'OptionalSettingsMain', start: 0x350_0000, length: 0x200 },
  { id: 'OptionalSettingsExt', start: 0x350_0900, length: 0x60 },
  {
    id: 'OptionalSettingsAprs',
    start: D890_MAP.OptionalSettingsAprs,
    length: D890_MAP.OptionalSettingsAprsLength,
  },
  { id: 'AlarmBitmap', start: D890_MAP.AlarmBitmap, length: D890_MAP.AlarmBitmapLength },
  { id: 'AlarmData', start: D890_MAP.AlarmData, length: D890_MAP.AlarmDataLength },
] as const;

export function isAddressInExtent(address: number, extent: AtD890MemoryExtent): boolean {
  return address >= extent.start && address < extent.start + extent.length;
}

export function findWritableExtentForAddress(address: number): AtD890MemoryExtent | undefined {
  return AT_D890_WRITABLE_EXTENTS.find((extent) => isAddressInExtent(address, extent));
}

export function isAtD890WritableAddress(address: number): boolean {
  if (address === AT_D890_SAFE_SKIP_WRITE_ADDR) return false;
  if (isAtD890ChannelDataAddress(address) && !isAtD890ChannelDataRealAddress(address)) {
    return false;
  }
  return findWritableExtentForAddress(address) !== undefined;
}

export function assertAtD890WritableAddress(address: number): void {
  if (!isAtD890TransmitAddress(address, new Set())) {
    if (address === AT_D890_SAFE_SKIP_WRITE_ADDR) {
      throw new RadioProtocolError(
        `D890 write refused at forbidden address 0x${address.toString(16)} (family safe-skip)`,
      );
    }
    if (isAtD890ChannelDataAddress(address) && !isAtD890ChannelDataRealAddress(address)) {
      throw new RadioProtocolError(
        `D890 write refused at 0x${address.toString(16)} — ChannelData mirrored address (not backed storage)`,
      );
    }
    throw new RadioProtocolError(
      `D890 write refused at 0x${address.toString(16)} — address outside allow-listed modelled banks`,
    );
  }
}

/**
 * Upload transmit fence: allow modelled banks, plus any address inside a touched erase unit
 * (preserved optional settings / alarms), while still refusing safe-skip and mirrors.
 */
export function isAtD890TransmitAddress(
  address: number,
  touchedUnitBases: ReadonlySet<number>,
): boolean {
  if (address === AT_D890_SAFE_SKIP_WRITE_ADDR) return false;
  if (isAtD890ChannelDataAddress(address) && !isAtD890ChannelDataRealAddress(address)) {
    return false;
  }
  if (touchedUnitBases.has(eraseUnitBaseFor(address))) return true;
  return isAtD890WritableAddress(address);
}

export function assertAtD890TransmitAddress(
  address: number,
  touchedUnitBases: ReadonlySet<number>,
): void {
  if (isAtD890TransmitAddress(address, touchedUnitBases)) return;
  if (address === AT_D890_SAFE_SKIP_WRITE_ADDR) {
    throw new RadioProtocolError(
      `D890 write refused at forbidden address 0x${address.toString(16)} (family safe-skip)`,
    );
  }
  if (isAtD890ChannelDataAddress(address) && !isAtD890ChannelDataRealAddress(address)) {
    throw new RadioProtocolError(
      `D890 write refused at 0x${address.toString(16)} — ChannelData mirrored address (not backed storage)`,
    );
  }
  throw new RadioProtocolError(
    `D890 write refused at 0x${address.toString(16)} — address outside touched erase units and modelled banks`,
  );
}

/** Fail before bytes reach serial when a span would spill past its declared bank extent. */
export function assertAtD890WritableSpan(address: number, length: number): void {
  if (length <= 0) return;
  const end = address + length;
  const startExtent = findWritableExtentForAddress(address);
  if (!startExtent) {
    throw new RadioProtocolError(
      `D890 write span starts outside allow-list at 0x${address.toString(16)} (length 0x${length.toString(16)})`,
    );
  }
  if (end > startExtent.start + startExtent.length) {
    throw new RadioProtocolError(
      `D890 write span 0x${address.toString(16)}+0x${length.toString(16)} exceeds ${startExtent.id} extent (max 0x${startExtent.length.toString(16)})`,
    );
  }
  // Entire span must stay inside one extent (no cross-bank spill).
  if (!isAddressInExtent(end - 1, startExtent)) {
    throw new RadioProtocolError(
      `D890 write span 0x${address.toString(16)}+0x${length.toString(16)} crosses bank boundary after ${startExtent.id}`,
    );
  }
}
