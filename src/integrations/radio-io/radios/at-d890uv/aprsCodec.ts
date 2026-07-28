/**
 * AT-D890UV APRS global config block — patch modelled offsets only.
 * Cite: anytone-cps `AprsSettings::encode_D890UV` — facts only.
 */

import { encodeAnytoneAprsAutoTxIntervalSec } from '@core/import-export/formats/anytone/aprsWireFormat.ts';
import type { MemoryMap } from '../../types.ts';
import type { RadioAprsDto } from '../../radioWriteProjection.ts';
import { encodeBcdAsHexU32 } from './bcd.ts';
import { D890_MAP } from './constants.ts';
import type { AtD890DownloadCache } from './memory.ts';
import { mergeMapRegionsIntoCache } from './memory.ts';

function writeU16Le(block: Uint8Array, offset: number, value: number): void {
  const v = value & 0xffff;
  block[offset] = v & 0xff;
  block[offset + 1] = (v >>> 8) & 0xff;
}

/** Patch modelled APRS global fields; leaves all other bytes unchanged. */
export function patchAtD890AprsConfigBlock(block: Uint8Array, aprs: RadioAprsDto): void {
  if (block.length < D890_MAP.AprsConfigMainLength) return;

  if (aprs.manualTxIntervalSec != null) {
    const sec = Math.max(0, Math.min(255, Math.trunc(aprs.manualTxIntervalSec)));
    block[0x0a] = sec;
  }
  if (aprs.autoTxIntervalSec != null) {
    block[0x0b] = encodeAnytoneAprsAutoTxIntervalSec(aprs.autoTxIntervalSec);
  }
  if (aprs.fixedLocationBeacon != null) {
    block[0x0d] = aprs.fixedLocationBeacon & 0xff;
  }
  if (aprs.fixedLatitude) {
    const lat = aprs.fixedLatitude;
    block[0x0e] = lat.degrees & 0xff;
    block[0x0f] = lat.minInt & 0xff;
    block[0x10] = lat.minMark & 0xff;
    block[0x11] = lat.hemisphere & 0xff;
  }
  if (aprs.fixedLongitude) {
    const lng = aprs.fixedLongitude;
    block[0x12] = lng.degrees & 0xff;
    block[0x13] = lng.minInt & 0xff;
    block[0x14] = lng.minMark & 0xff;
    block[0x15] = lng.hemisphere & 0xff;
  }

  const slots = aprs.digitalSlots;
  if (slots) {
    for (let i = 0; i < 8; i++) {
      const slot = slots[i];
      if (!slot) continue;
      writeU16Le(block, 0x40 + i * 2, slot.reportChannelWire);
      if (slot.targetDmrId != null) {
        block.set(encodeBcdAsHexU32(slot.targetDmrId), 0x50 + i * 4);
      }
      block[0x70 + i] = slot.callType & 0xff;
      block[0x79 + i] = slot.timeslot & 0xff;
    }
  }
}

export function encodeAprsIntoAtD890Image(
  image: MemoryMap,
  aprs: RadioAprsDto | null | undefined,
): MemoryMap {
  if (aprs == null) return image;
  const block = image.get(D890_MAP.AprsConfigMain, D890_MAP.AprsConfigMainLength);
  patchAtD890AprsConfigBlock(block, aprs);
  image.set(D890_MAP.AprsConfigMain, block);
  return image;
}

export function syncAprsRegionsToCache(cache: AtD890DownloadCache, image: MemoryMap): void {
  mergeMapRegionsIntoCache(cache, image, [
    { address: D890_MAP.AprsConfigMain, length: D890_MAP.AprsConfigMainLength },
  ]);
}
