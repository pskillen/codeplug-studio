/** bbcd frequency fields — CHIRP stores int(hz/10) in 4-byte BCD. */

export function decodeBcdFreq(bytes: Uint8Array): number {
  const digits: number[] = [];
  for (let i = 0; i < 4; i++) {
    digits.push(bytes[i]! & 0x0f, (bytes[i]! >> 4) & 0x0f);
  }
  let val = 0;
  let mult = 1;
  for (let i = 0; i < 8; i++) {
    val += digits[i]! * mult;
    mult *= 10;
  }
  return val * 10;
}

export function encodeBcdFreq(hz: number): Uint8Array {
  let val = Math.floor(hz / 10);
  const digits: number[] = [];
  for (let i = 0; i < 8; i++) {
    digits.push(val % 10);
    val = Math.floor(val / 10);
  }
  const out = new Uint8Array(4);
  for (let i = 0; i < 4; i++) {
    out[i] = (digits[i * 2 + 1]! << 4) | digits[i * 2]!;
  }
  return out;
}
