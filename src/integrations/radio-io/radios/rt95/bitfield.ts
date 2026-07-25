/** 1-based memory index ↔ 32-byte occupied/scan bitfields @ 0x1940 / 0x1960. */

import {
  RT95_BITFIELD_BYTES,
  RT95_CHANNEL_COUNT,
  RT95_OCCUPIED_BITFIELD_OFFSET,
  RT95_SCAN_BITFIELD_OFFSET,
} from './constants.ts';

export function memoryIndexToBitIndex(memoryNumber: number): number {
  if (!Number.isInteger(memoryNumber) || memoryNumber < 1 || memoryNumber > RT95_CHANNEL_COUNT) {
    throw new RangeError(`RT95 memory index must be 1..${RT95_CHANNEL_COUNT}, got ${memoryNumber}`);
  }
  return memoryNumber - 1;
}

export function getBitfieldBit(bytes: Uint8Array, offset: number, memoryNumber: number): boolean {
  const bitIndex = memoryIndexToBitIndex(memoryNumber);
  const byteIdx = Math.floor(bitIndex / 8);
  const bitIdx = bitIndex % 8;
  if (offset + byteIdx >= bytes.length) return false;
  return ((bytes[offset + byteIdx]! >> bitIdx) & 1) === 1;
}

export function setBitfieldBit(
  bytes: Uint8Array,
  offset: number,
  memoryNumber: number,
  value: boolean,
): void {
  const bitIndex = memoryIndexToBitIndex(memoryNumber);
  const byteIdx = Math.floor(bitIndex / 8);
  const bitIdx = bitIndex % 8;
  if (offset + byteIdx >= bytes.length) {
    throw new RangeError(`Bitfield offset 0x${offset.toString(16)} out of range`);
  }
  const idx = offset + byteIdx;
  if (value) {
    bytes[idx] = bytes[idx]! | (1 << bitIdx);
  } else {
    bytes[idx] = bytes[idx]! & ~(1 << bitIdx);
  }
}

export function clearBitfield(bytes: Uint8Array, offset: number): void {
  bytes.fill(0, offset, offset + RT95_BITFIELD_BYTES);
}

export function syncOccupiedBitfield(
  bytes: Uint8Array,
  occupiedMemoryNumbers: readonly number[],
): void {
  clearBitfield(bytes, RT95_OCCUPIED_BITFIELD_OFFSET);
  for (const n of occupiedMemoryNumbers) {
    setBitfieldBit(bytes, RT95_OCCUPIED_BITFIELD_OFFSET, n, true);
  }
}

export function syncScanBitfield(bytes: Uint8Array, scanMemoryNumbers: readonly number[]): void {
  clearBitfield(bytes, RT95_SCAN_BITFIELD_OFFSET);
  for (const n of scanMemoryNumbers) {
    setBitfieldBit(bytes, RT95_SCAN_BITFIELD_OFFSET, n, true);
  }
}

export function countOccupiedFromBitfield(bytes: Uint8Array): number {
  let count = 0;
  for (let n = 1; n <= RT95_CHANNEL_COUNT; n++) {
    if (getBitfieldBit(bytes, RT95_OCCUPIED_BITFIELD_OFFSET, n)) count += 1;
  }
  return count;
}

export function isMemoryOccupied(bytes: Uint8Array, memoryNumber: number): boolean {
  return getBitfieldBit(bytes, RT95_OCCUPIED_BITFIELD_OFFSET, memoryNumber);
}

export function isMemoryScanEnabled(bytes: Uint8Array, memoryNumber: number): boolean {
  return getBitfieldBit(bytes, RT95_SCAN_BITFIELD_OFFSET, memoryNumber);
}
