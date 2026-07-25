/**
 * UV-5R Mini 32-byte channel record codec — thin wrapper over uv17pro-family.
 */

import type { MemoryMap } from '../../types.ts';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import { UV5R_MINI_LAYOUT } from '../uv17pro-family/layout.ts';
import {
  decodeBcdFreq,
  encodeBcdFreq,
  decodeTone,
  encodeTone,
  decodeChannelRecord as decodeChannelRecordFamily,
  encodeChannelRecord as encodeChannelRecordFamily,
  decodeChannelsFromImage as decodeChannelsFromImageFamily,
  encodeChannelsIntoImage as encodeChannelsIntoImageFamily,
  readFirmwareFromImage as readFirmwareFromImageFamily,
  UV17PRO_SCAN_BIT,
  UV17PRO_WIDE_BIT,
} from '../uv17pro-family/channelCodec.ts';

export { decodeBcdFreq, encodeBcdFreq, decodeTone, encodeTone };

/** @deprecated Use UV17PRO_SCAN_BIT */
export const UV5R_MINI_SCAN_BIT = UV17PRO_SCAN_BIT;

/** @deprecated Use UV17PRO_WIDE_BIT */
export const UV5R_MINI_WIDE_BIT = UV17PRO_WIDE_BIT;

export function decodeChannelRecord(raw: Uint8Array, slotIndex: number): RadioChannelDto {
  return decodeChannelRecordFamily(UV5R_MINI_LAYOUT, raw, slotIndex);
}

export function encodeChannelRecord(dto: RadioChannelDto): Uint8Array {
  return encodeChannelRecordFamily(UV5R_MINI_LAYOUT, dto);
}

export function decodeChannelsFromImage(image: Uint8Array | MemoryMap): RadioChannelDto[] {
  return decodeChannelsFromImageFamily(UV5R_MINI_LAYOUT, image);
}

export function encodeChannelsIntoImage(
  image: Uint8Array | MemoryMap,
  channels: readonly RadioChannelDto[],
): void {
  return encodeChannelsIntoImageFamily(UV5R_MINI_LAYOUT, image, channels);
}

export function readFirmwareFromImage(image: Uint8Array | MemoryMap): string | undefined {
  return readFirmwareFromImageFamily(UV5R_MINI_LAYOUT, image);
}
