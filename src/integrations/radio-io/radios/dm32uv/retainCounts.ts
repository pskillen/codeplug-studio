/**
 * Count-only decoders for DM-32UV sparse blocks (Radio image summary).
 * Cite: docs/reference/radios/baofeng/dm-32uv/contacts-zones-lists.md
 */

import { DM32_BLOCK_SIZE, DM32_METADATA, DM32_METADATA_OFFSET, DM32_OFFSET } from './constants.ts';

const TD = new TextDecoder('ascii', { fatal: false });

function isEmptyNameByte(b: number): boolean {
  return b === 0 || b === 0xff;
}

function countAsciiNames(
  data: Uint8Array,
  entrySize: number,
  start: number,
  nameLen: number,
): number {
  let count = 0;
  for (let off = start; off + nameLen <= data.length && off < DM32_BLOCK_SIZE; off += entrySize) {
    if (isEmptyNameByte(data[off]!)) break;
    count += 1;
  }
  return count;
}

export interface Dm32OnRadioCounts {
  occupiedChannels: number;
  emptyChannelSlots: number;
  zoneCount: number;
  scanListCount: number;
  talkGroupCount: number;
  rxGroupCount: number;
  radioIdCount: number;
  quickMessageCount: number;
  digitalEmergencyCount: number;
  analogEmergencyCount: number;
}

export interface Dm32SparseBlockInput {
  address: number;
  data: Uint8Array;
  metadata: number;
  type: string;
}

export function countZonesInBlock(data: Uint8Array): number {
  const entrySize = 145;
  const start = 16;
  return countAsciiNames(data, entrySize, start, 11);
}

export function countScanListsInBlock(data: Uint8Array): number {
  const n = data[0] ?? 0;
  return n > 32 ? 32 : n;
}

export function countTalkGroupsInBlocks(blocks: readonly Dm32SparseBlockInput[]): number {
  const counter = blocks.find((b) => b.metadata === DM32_METADATA.CONFIG_TG_COUNTER);
  if (counter) {
    const n = counter.data[DM32_OFFSET.TALK_GROUP_COUNTER] ?? 0;
    if (n > 0 && n <= 800) return n;
  }
  const tg = blocks.find((b) => b.metadata === DM32_METADATA.TALK_GROUPS);
  if (!tg) return 0;
  let count = 0;
  const data = tg.data;
  let off = 0;
  if (data[0] === 0) off = 1;
  while (off + 20 <= DM32_BLOCK_SIZE) {
    if (isEmptyNameByte(data[off]!)) break;
    count += 1;
    off += 20;
  }
  return Math.min(count, 800);
}

export function countRxGroupsInBlock(data: Uint8Array): number {
  const mask = data[0]! | (data[1]! << 8) | (data[2]! << 16) | (data[3]! << 24);
  let count = 0;
  for (let i = 0; i < 32; i++) {
    if (mask & (1 << i)) count += 1;
  }
  return count;
}

export function countRadioIdsInBlock(data: Uint8Array): number {
  const n = data[0] ?? 0;
  return n > 250 ? 250 : n;
}

export function countQuickMessagesInBlock(data: Uint8Array): number {
  let count = 0;
  const entrySize = 32;
  for (let off = 0; off + entrySize <= DM32_BLOCK_SIZE; off += entrySize) {
    if (isEmptyNameByte(data[off]!)) break;
    count += 1;
  }
  return count;
}

export function countEmergenciesInBlock(data: Uint8Array, entrySize: number): number {
  let count = 0;
  for (let off = 0; off + entrySize <= DM32_BLOCK_SIZE; off += entrySize) {
    if (isEmptyNameByte(data[off]!)) break;
    count += 1;
  }
  return Math.min(count, 16);
}

export function countEncryptionKeysInBlock(data: Uint8Array): number {
  const start = 0x300;
  const entrySize = 16;
  let count = 0;
  for (let off = start; off + entrySize <= DM32_BLOCK_SIZE; off += entrySize) {
    const slice = data.subarray(off, off + entrySize);
    if (slice.every((b) => b === 0 || b === 0xff)) break;
    count += 1;
  }
  return count;
}

export function aggregateOnRadioCounts(
  blocks: readonly Dm32SparseBlockInput[],
  occupiedChannels: number,
  totalChannelSlots: number,
): Dm32OnRadioCounts {
  let zoneCount = 0;
  let scanListCount = 0;
  let rxGroupCount = 0;
  let radioIdCount = 0;
  let quickMessageCount = 0;
  let digitalEmergencyCount = 0;
  let analogEmergencyCount = 0;

  for (const b of blocks) {
    if (b.metadata === DM32_METADATA.ZONE || b.type === 'zone') {
      zoneCount += countZonesInBlock(b.data);
    } else if (b.metadata === DM32_METADATA.SCAN_LIST || b.type === 'scan') {
      scanListCount += countScanListsInBlock(b.data);
    } else if (b.metadata === DM32_METADATA.RX_GROUPS || b.type === 'rxgroup') {
      rxGroupCount += countRxGroupsInBlock(b.data);
    } else if (b.metadata === DM32_METADATA.DMR_RADIO_IDS || b.type === 'dmrradioid') {
      radioIdCount += countRadioIdsInBlock(b.data);
    } else if (b.metadata === DM32_METADATA.QUICK_MESSAGES || b.type === 'message') {
      quickMessageCount += countQuickMessagesInBlock(b.data);
    } else if (b.metadata === 0x03 || b.type === 'digitalemergency') {
      digitalEmergencyCount += countEmergenciesInBlock(b.data, 20);
    } else if (b.metadata === DM32_METADATA.ANALOG_EMERGENCY || b.type === 'analogemergency') {
      analogEmergencyCount += countEmergenciesInBlock(b.data, 36);
      // encryption keys co-resident — counted separately in ancillary
    }
  }

  const talkGroupCount = countTalkGroupsInBlocks(blocks);

  return {
    occupiedChannels,
    emptyChannelSlots: Math.max(0, totalChannelSlots - occupiedChannels),
    zoneCount,
    scanListCount,
    talkGroupCount,
    rxGroupCount,
    radioIdCount,
    quickMessageCount,
    digitalEmergencyCount,
    analogEmergencyCount,
  };
}

/** Read power-on display line (14 ASCII) at offset. */
export function readAsciiLine(data: Uint8Array, offset: number, len: number): string {
  const slice = data.subarray(offset, offset + len);
  let end = slice.length;
  while (end > 0 && (slice[end - 1] === 0 || slice[end - 1] === 0xff)) end -= 1;
  return TD.decode(slice.subarray(0, end)).trim();
}

export { DM32_METADATA_OFFSET };
