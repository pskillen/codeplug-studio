import type { MemoryMap } from '../types.ts';

class ContiguousMemoryMap implements MemoryMap {
  readonly bytes: Uint8Array;

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
  }

  get size(): number {
    return this.bytes.length;
  }

  get(offset: number, length: number): Uint8Array {
    assertRange(offset, length, this.bytes.length);
    return this.bytes.slice(offset, offset + length);
  }

  set(offset: number, data: Uint8Array): void {
    assertRange(offset, data.length, this.bytes.length);
    this.bytes.set(data, offset);
  }

  fill(offset: number, length: number, value: number): void {
    assertRange(offset, length, this.bytes.length);
    this.bytes.fill(value & 0xff, offset, offset + length);
  }
}

function assertRange(offset: number, length: number, size: number): void {
  if (!Number.isInteger(offset) || offset < 0) {
    throw new RangeError(`MemoryMap offset must be a non-negative integer, got ${offset}`);
  }
  if (!Number.isInteger(length) || length < 0) {
    throw new RangeError(`MemoryMap length must be a non-negative integer, got ${length}`);
  }
  if (offset + length > size) {
    throw new RangeError(
      `MemoryMap range [${offset}, ${offset + length}) exceeds size ${size}`,
    );
  }
}

/** Allocate a zero-filled contiguous image of `size` bytes. */
export function createMemoryMap(size: number): MemoryMap {
  if (!Number.isInteger(size) || size < 0) {
    throw new RangeError(`MemoryMap size must be a non-negative integer, got ${size}`);
  }
  return new ContiguousMemoryMap(new Uint8Array(size));
}

/** Wrap (copy of) existing bytes as a MemoryMap. */
export function memoryMapFromBytes(bytes: Uint8Array): MemoryMap {
  return new ContiguousMemoryMap(bytes.slice());
}

/** Copy of the backing store (safe to retain after further mutations). */
export function memoryMapToBytes(map: MemoryMap): Uint8Array {
  return map.bytes.slice();
}
