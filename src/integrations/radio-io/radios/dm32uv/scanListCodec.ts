/**
 * DM-32UV scan-list encode — metadata 0x11 blocks.
 * Cite: NeonPlug encodeScanList + writeAllData packing; tier-3 contacts-zones-lists.md.
 */

import type { MemoryMap } from '../../types.ts';
import type { RadioScanListDto } from '../../radioWriteProjection.ts';
import { DM32UV_LIMITS } from '@core/radios/baofeng/dm-32uv/limits.ts';
import { DM32_BLOCK_SIZE, DM32_METADATA, DM32_METADATA_OFFSET } from './constants.ts';

export const DM32_SCAN_LIST_ENTRY_SIZE = 57;
export const DM32_SCAN_LIST_MAX_MEMBERS = DM32UV_LIMITS.SCAN_LIST_MEMBERS_MAX;
export const DM32_SCAN_LISTS_MAX = DM32UV_LIMITS.SCAN_LISTS_MAX;

const TE = new TextEncoder();

/**
 * Encode one scan list (57 bytes).
 * Defaults: CTC detection 0, designated TX = current (scanTxMode 1), hang 50 (5.0s).
 */
export function encodeDm32ScanList(list: RadioScanListDto): Uint8Array {
  const data = new Uint8Array(DM32_SCAN_LIST_ENTRY_SIZE);
  data.fill(0x00);

  const nameBytes = TE.encode(list.wireName.slice(0, 10));
  const nameLength = Math.min(nameBytes.length, 10);
  data.set(nameBytes.subarray(0, nameLength), 0);
  data[nameLength] = 0;

  const channelCount = Math.min(list.channelNumbers.length, DM32_SCAN_LIST_MAX_MEMBERS);
  data[0x0b] = channelCount;

  // CTC=0 (Detection), TX mode: 1 = current when no designated channel, else 2
  const hasDesignated = list.designatedTxChannel != null && list.designatedTxChannel > 0;
  const scanTxMode = hasDesignated ? 2 : 1;
  data[0x0c] = 0 | (scanTxMode << 2);
  data[0x0d] = 50; // 5.0 s hang
  data[0x0e] = 0; // priority types none

  if (hasDesignated) {
    const ch = list.designatedTxChannel!;
    const encoded = ch < 2 ? 0 : ch - 2;
    data[0x11] = encoded & 0xff;
    data[0x12] = (encoded >>> 8) & 0xff;
  }

  for (let i = 0; i < channelCount; i++) {
    const ch = list.channelNumbers[i]!;
    const off = 0x1a + i * 2;
    data[off] = ch & 0xff;
    data[off + 1] = (ch >>> 8) & 0xff;
  }
  if (channelCount < 15) {
    const end = 0x1a + channelCount * 2;
    data[end] = 0x00;
    data[end + 1] = 0x00;
  }

  return data;
}

export interface Dm32ScanEncodeContext {
  addressBase: number;
  discovered: readonly { address: number; metadata: number }[];
}

/** Entry offset for 1-based list N: (57 * N) - 56 */
export function dm32ScanListEntryOffset(listNum1Based: number): number {
  return DM32_SCAN_LIST_ENTRY_SIZE * listNum1Based - 56;
}

/**
 * Vacant scan-list slot after `0xFF` bank fill — firmware treats `+0x0B` `0xFF` as 255 members
 * (zone vacant-slot parity in `zoneCodec.clearDm32ZoneSlot`).
 */
export function clearDm32VacantScanListSlot(buf: Uint8Array, listNum1Based: number): void {
  const off = dm32ScanListEntryOffset(listNum1Based);
  if (off < 0 || off + DM32_SCAN_LIST_ENTRY_SIZE > buf.length) return;
  buf.fill(0xff, off, off + DM32_SCAN_LIST_ENTRY_SIZE);
  buf[off] = 0x00;
  buf[off + 0x0b] = 0x00;
}

/**
 * Rewrite scan-list block(s) metadata 0x11.
 * Count at byte 0; entries at (57*N)-56.
 */
export function encodeScanListsIntoDm32Image(
  image: MemoryMap,
  ctx: Dm32ScanEncodeContext,
  scanLists: readonly RadioScanListDto[],
): MemoryMap {
  const scanBlocks = ctx.discovered
    .filter((b) => b.metadata === DM32_METADATA.SCAN_LIST)
    .sort((a, b) => a.address - b.address);
  if (scanBlocks.length === 0) return image;

  const lists = scanLists.slice(0, DM32_SCAN_LISTS_MAX);
  const encoded = lists.map((l) => encodeDm32ScanList(l));

  // Concatenate into a contiguous buffer large enough for all entries
  const totalSize = Math.max(
    DM32_BLOCK_SIZE,
    dm32ScanListEntryOffset(encoded.length) + DM32_SCAN_LIST_ENTRY_SIZE,
  );
  const all = new Uint8Array(totalSize);
  all.fill(0xff);
  all[0] = encoded.length & 0xff;
  for (let i = 0; i < encoded.length; i++) {
    const off = dm32ScanListEntryOffset(i + 1);
    all.set(encoded[i]!, off);
  }
  for (let n = encoded.length + 1; n <= DM32_SCAN_LISTS_MAX; n++) {
    clearDm32VacantScanListSlot(all, n);
  }

  for (let blockIdx = 0; blockIdx < scanBlocks.length; blockIdx++) {
    const block = scanBlocks[blockIdx]!;
    const base = block.address - ctx.addressBase;
    const slice = all.subarray(blockIdx * DM32_BLOCK_SIZE, (blockIdx + 1) * DM32_BLOCK_SIZE);
    const chunk = new Uint8Array(DM32_BLOCK_SIZE);
    chunk.fill(0xff);
    chunk.set(slice.subarray(0, Math.min(slice.length, DM32_BLOCK_SIZE)));
    if (blockIdx === 0) {
      chunk[0] = encoded.length & 0xff;
    }
    chunk[DM32_METADATA_OFFSET] = DM32_METADATA.SCAN_LIST;
    image.set(base, chunk);
  }

  return image;
}
