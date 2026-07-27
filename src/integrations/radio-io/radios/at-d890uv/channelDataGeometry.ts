/**
 * AT-D890UV ChannelData address-space geometry — backed low halves only.
 *
 * Measured on hardware 2026-07-27: within each `0x80000` block pitch, only the low
 * `0x40000` is backed; the upper half mirrors it at `+0x40000`.
 */

import { D890_MAP } from './constants.ts';

const CHANNEL_DATA_END =
  D890_MAP.ChannelData + D890_MAP.ChannelDataBlockCount * D890_MAP.ChannelDataBlockOffset;

/** True when `address` lies in the ChannelData bank address span. */
export function isAtD890ChannelDataAddress(address: number): boolean {
  return address >= D890_MAP.ChannelData && address < CHANNEL_DATA_END;
}

/** Offset from the start of the containing block (`0..ChannelDataBlockOffset-1`). */
export function channelDataOffsetInBlock(address: number): number {
  return (address - D890_MAP.ChannelData) % D890_MAP.ChannelDataBlockOffset;
}

/** 0-based block index for a ChannelData address, or `-1` when outside the bank. */
export function channelDataBlockIndex(address: number): number {
  if (!isAtD890ChannelDataAddress(address)) return -1;
  return Math.floor((address - D890_MAP.ChannelData) / D890_MAP.ChannelDataBlockOffset);
}

/** True when `address` lies in backed storage rather than a block's mirrored upper half. */
export function isAtD890ChannelDataRealAddress(address: number): boolean {
  if (!isAtD890ChannelDataAddress(address)) return false;
  const offsetInBlock = channelDataOffsetInBlock(address);
  return offsetInBlock >= 0 && offsetInBlock < D890_MAP.ChannelDataBackedBytes;
}
