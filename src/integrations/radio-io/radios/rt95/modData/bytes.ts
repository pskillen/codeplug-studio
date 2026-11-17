/** Byte helpers shared by the MMD1 encoders (`encode.ts`, `sections.ts`). */

export function u16le(value: number): [number, number] {
  return [value & 0xff, (value >> 8) & 0xff];
}

/** Map 0x0000 to 0x0001 and 0xFFFF to 0xFFFE. */
export function mapGeneration(crc: number): number {
  if (crc === 0x0000) return 0x0001;
  if (crc === 0xffff) return 0xfffe;
  return crc;
}

export function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}
