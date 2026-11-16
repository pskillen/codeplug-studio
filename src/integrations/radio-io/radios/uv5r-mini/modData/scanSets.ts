import { crc16Xmodem } from '../../dm32uv/firmwareUpdate/crc16Xmodem.ts';
import type { Uv5rMiniZoneFrame } from './encode.ts';

export const MMZS_MEMBER_CAPACITY_BITS = 4432;

/** Apply the firmware's first-fitting-zone rule to member flags in slot order. */
export function fillMiniScanSets(sets: readonly (readonly boolean[])[]): {
  bits: boolean[];
  fallback: number[];
  kinds: number[];
  needed: number;
} {
  const bits: boolean[] = [];
  const fallback: number[] = [];
  const kinds: number[] = [];
  let needed = 0;
  sets.forEach((set, i) => {
    if (set.every(Boolean)) {
      kinds.push(0);
      return;
    }
    needed += set.length;
    if (bits.length + set.length > MMZS_MEMBER_CAPACITY_BITS) {
      kinds.push(0);
      fallback.push(i);
      return;
    }
    kinds.push(1);
    bits.push(...set);
  });
  return { bits, fallback, kinds, needed };
}

/** Pack the filled member flags into the firmware's MMZS block. */
export function encodeMiniScanSets(
  sets: readonly (readonly boolean[])[],
  generation: number,
): { frames: Uv5rMiniZoneFrame[]; fallback: number[]; kinds: number[]; needed: number } {
  const { bits, fallback, kinds, needed } = fillMiniScanSets(sets);
  const length = Math.ceil(bits.length / 8);
  const block = new Uint8Array(22 + length);
  block.set([
    0x4d,
    0x4d,
    0x5a,
    0x53,
    1,
    sets.length,
    0,
    0,
    generation & 255,
    generation >> 8,
    length & 255,
    length >> 8,
  ]);
  kinds.forEach((kind, i) => {
    block[16 + (i >> 2)]! |= kind << (2 * (i & 3));
  });
  bits.forEach((bit, i) => {
    if (bit) block[22 + (i >> 3)]! |= 1 << (i & 7);
  });
  const covered = new Uint8Array(block.length - 2);
  covered.set(block.subarray(0, 14));
  covered.set(block.subarray(16), 14);
  const crc = crc16Xmodem(covered);
  block[14] = crc & 255;
  block[15] = crc >> 8;
  const frames: Uv5rMiniZoneFrame[] = [];
  for (let offset = 0; offset < block.length; offset += 64) {
    const bytes = new Uint8Array(64).fill(255);
    bytes.set(block.subarray(offset, offset + 64));
    frames.push({ address: offset < 448 ? 0xc040 + offset : 0xc380 + offset - 448, bytes });
  }
  return { frames, fallback, kinds, needed };
}
