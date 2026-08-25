/**
 * RT95 / 778UV `bbcd[4]` frequency fields.
 * CHIRP stores `int(hz/10)` with most-significant digit pair in byte 0
 * (same digit-string packing as AT-D890 10 Hz BCD).
 */

export function decodeBcdFreq(bytes: Uint8Array): number {
  if (bytes.length < 4) return 0;
  const digits = Array.from(bytes.subarray(0, 4))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  if (!/^\d{8}$/.test(digits)) return 0;
  const units10Hz = Number.parseInt(digits, 10);
  return Number.isFinite(units10Hz) ? units10Hz * 10 : 0;
}

export function encodeBcdFreq(hz: number): Uint8Array {
  const units10Hz = Math.max(0, Math.round(hz / 10));
  const digits = String(units10Hz).padStart(8, '0').slice(-8);
  const out = new Uint8Array(4);
  for (let i = 0; i < 4; i++) {
    out[i] = Number.parseInt(digits.slice(i * 2, i * 2 + 2), 16) & 0xff;
  }
  return out;
}
