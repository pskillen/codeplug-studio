/**
 * DM-32UV APRS settings slice — patch offsets 0x301–0x334 on metadata 0x04.
 * Cite: NeonPlug encodeRadioSettings APRS fields; tier-3 settings.md.
 */

import type { MemoryMap } from '../../types.ts';
import type { RadioAprsDto } from '../../radioWriteProjection.ts';
import { DM32_BLOCK_SIZE, DM32_METADATA } from './constants.ts';
import type { Dm32ChannelDecodeContext } from './channelCodec.ts';

export const DM32_APRS_SLICE_START = 0x301;
export const DM32_APRS_SLICE_END = 0x334; // inclusive

const TE = new TextEncoder();

function writeAsciiField(
  block: Uint8Array,
  offset: number,
  maxLen: number,
  text: string,
): void {
  block.fill(0xff, offset, offset + maxLen);
  const bytes = TE.encode(text.slice(0, maxLen - 1));
  block.set(bytes, offset);
  block[offset + bytes.length] = 0x00;
}

function writeU16Le(block: Uint8Array, offset: number, value: number): void {
  const v = value & 0xffff;
  block[offset] = v & 0xff;
  block[offset + 1] = (v >>> 8) & 0xff;
}

/**
 * Patch APRS / GPS-position bytes on a settings block in place.
 * Preserves all bytes outside 0x301–0x334.
 */
export function patchDm32AprsSettingsSlice(block: Uint8Array, aprs: RadioAprsDto): void {
  if (block.length < DM32_APRS_SLICE_END + 1) return;

  if (aprs.scheduledSendTime != null) {
    block[0x301] = aprs.scheduledSendTime & 0xff;
  }
  if (aprs.manualBeacon != null) {
    const cur = block[0x302] ?? 0;
    block[0x302] = aprs.manualBeacon ? cur | 0x01 : cur & 0xfe;
  }

  if (aprs.latitude != null) {
    writeAsciiField(block, 0x306, 9, aprs.latitude);
  }
  if (aprs.latitudeHemisphere != null) {
    block[0x30f] = aprs.latitudeHemisphere === 'N' ? 0x4e : 0x53;
  }
  if (aprs.longitude != null) {
    writeAsciiField(block, 0x310, 9, aprs.longitude);
  }
  if (aprs.longitudeHemisphere != null) {
    block[0x319] = aprs.longitudeHemisphere === 'E' ? 0x45 : 0x57;
  }

  const channels = aprs.reportChannelNumbers;
  for (let i = 0; i < 8; i++) {
    writeU16Le(block, 0x320 + i * 2, channels[i] ?? 0);
  }

  if (aprs.repeaterActiveDelay != null) {
    block[0x330] = aprs.repeaterActiveDelay & 0xff;
  }
  if (aprs.callType != null) {
    const cur = block[0x331] ?? 0;
    block[0x331] = aprs.callType ? cur | 0x01 : cur & 0xfe;
  }
  if (aprs.uploadDmrId != null) {
    const id = Math.max(0, Math.min(16_776_415, aprs.uploadDmrId >>> 0));
    block[0x332] = (id >>> 16) & 0xff;
    block[0x333] = (id >>> 8) & 0xff;
    block[0x334] = id & 0xff;
  }
}

/** Find settings block and apply APRS slice; no-op when block missing. */
export function encodeAprsIntoDm32Image(
  image: MemoryMap,
  ctx: Dm32ChannelDecodeContext,
  aprs: RadioAprsDto | null | undefined,
): MemoryMap {
  if (aprs == null) return image;
  const hit = ctx.discovered.find((b) => b.metadata === DM32_METADATA.VFO_SETTINGS);
  if (!hit) return image;
  const mapOff = hit.address - ctx.addressBase;
  if (mapOff < 0 || mapOff + DM32_BLOCK_SIZE > image.size) return image;
  const block = image.bytes.subarray(mapOff, mapOff + DM32_BLOCK_SIZE);
  patchDm32AprsSettingsSlice(block, aprs);
  return image;
}
