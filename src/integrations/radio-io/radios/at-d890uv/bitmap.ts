/** Occupancy bitmap helpers for D890 set regions. */

export function listSetBits(data: Uint8Array, inverted = false): number[] {
  const out: number[] = [];
  for (let byteIndex = 0; byteIndex < data.length; byteIndex++) {
    const bits = data[byteIndex]!;
    for (let bit = 0; bit < 8; bit++) {
      const set = (bits & (1 << bit)) !== 0;
      const occupied = inverted ? !set : set;
      if (occupied) out.push(byteIndex * 8 + bit);
    }
  }
  return out;
}

export function setBitmapBit(
  data: Uint8Array,
  index: number,
  occupied: boolean,
  inverted = false,
): void {
  const byteIndex = Math.floor(index / 8);
  const bitIndex = index % 8;
  if (byteIndex < 0 || byteIndex >= data.length) return;
  const shouldSet = inverted ? !occupied : occupied;
  if (shouldSet) {
    data[byteIndex] = (data[byteIndex]! | (1 << bitIndex)) & 0xff;
  } else {
    data[byteIndex] = data[byteIndex]! & ~(1 << bitIndex) & 0xff;
  }
}

export function clearBitmap(data: Uint8Array, inverted = false): void {
  data.fill(inverted ? 0xff : 0);
}
