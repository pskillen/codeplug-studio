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
import { eraseUnitBaseFor, isAtD890EraseUnitBookkeepingAddress } from './eraseUnits.ts';
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
  { id: 'AprsConfigMain', start: D890_MAP.AprsConfigMain, length: D890_MAP.AprsConfigMainLength },
  {
    id: 'AprsReceiveFilters',
    start: D890_MAP.AprsReceiveFilters,
    length: D890_MAP.AprsReceiveFiltersLength,
  },
  { id: 'AmAirSet', start: D890_MAP.AmAirSet, length: D890_MAP.AmAirSetLength },
  {
    id: 'AmAirData',
    start: D890_MAP.AmAirData,
    length: D890_MAP.AmAirDataStride * D890_MAP.AmAirCount,
  },
  { id: 'AmZoneSet', start: D890_MAP.AmZoneSet, length: D890_MAP.AmZoneSetLength },
  {
    id: 'AmZoneAChannel',
    start: D890_MAP.AmZoneAChannel,
    length: D890_MAP.AmZoneAChannelLength,
  },
  { id: 'AmZoneScan', start: D890_MAP.AmZoneScan, length: D890_MAP.AmZoneScanLength },
  {
    id: 'AmZoneData',
    start: D890_MAP.AmZoneData,
    length: D890_MAP.AmZoneDataStride * D890_MAP.AmZoneCount,
  },
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
  // ⚠️ DO NOT REMOVE, AND DO NOT ADD A FLAG TO RE-ENABLE THIS.
  // +0x3fbf0 and +0x3fff0 in every 0x40000 erase unit are the radio's own flash
  // sector-management markers, not codeplug payload. The radio maintains them itself;
  // the official Anytone CPS never writes them.
  //
  // fe6955e3's whole-unit RMW writeback swept them into our transmitted set. For three
  // days every Studio write was ACKed, reached flash, and landed 0x40000 above the
  // address we sent while the live bank kept its old contents — the radio was
  // unprogrammable and the cause was invisible.
  //
  // Restoring these writes as a controlled experiment on 2026-07-30 made the radio
  // display "Program error please initialise the radio!" and factory-reset itself,
  // destroying the operator's configuration. Writing these addresses is not a
  // diagnostic option. See docs/reference/radios/anytone/at-d890uv/flash-sectors.md
  if (isAtD890EraseUnitBookkeepingAddress(address)) return false;
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
  if (isAtD890EraseUnitBookkeepingAddress(address)) {
    throw new RadioProtocolError(
      `D890 write refused at 0x${address.toString(16)} — erase-unit flash sector-management marker (never write)`,
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
