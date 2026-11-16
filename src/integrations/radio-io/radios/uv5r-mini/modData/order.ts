import { crc16Xmodem } from '../../dm32uv/firmwareUpdate/crc16Xmodem.ts';

/** Fill MMZO after the already-filled MMZS stream, trying later zones even after one fails. */
export function encodeMiniOrder(
  zones: readonly (readonly number[])[],
  setsLength: number,
  generation: number,
): {
  block?: Uint8Array;
  offset?: number;
  fallback: number[];
  kinds: number[];
} {
  const offset = Math.ceil((22 + setsLength) / 16) * 16;
  let left = offset + 22 <= 576 ? (576 - offset - 22) * 8 : -1;
  const bits: number[] = [];
  const fallback: number[] = [];
  const kinds = zones.map((slots, i) => {
    const sorted = [...slots].sort((a, b) => a - b);
    if (slots.every((slot, j) => slot === sorted[j])) return 0;
    const width = Math.ceil(Math.log2(slots.length));
    const need = slots.length * width;
    if (need > left) {
      fallback.push(i);
      return 0;
    }
    left -= need;
    for (const slot of slots) {
      const rank = sorted.indexOf(slot);
      for (let b = 0; b < width; b++) bits.push((rank >> b) & 1);
    }
    return 1;
  });
  if (offset + 22 > 576) return { kinds, fallback };
  const length = Math.ceil(bits.length / 8);
  const block = new Uint8Array(22 + length);
  block.set([
    0x4d,
    0x4d,
    0x5a,
    0x4f,
    1,
    zones.length,
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
    block[22 + (i >> 3)]! |= bit << (i & 7);
  });
  const covered = new Uint8Array(block.length - 2);
  covered.set(block.subarray(0, 14));
  covered.set(block.subarray(16), 14);
  const crc = crc16Xmodem(covered);
  block[14] = crc & 255;
  block[15] = crc >> 8;
  return { block, offset, fallback, kinds };
}
