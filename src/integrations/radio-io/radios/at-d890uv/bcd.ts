/** BCD-as-hex frequency packing used by Anytone D890 channel records. */

export function decodeBcdFrequencyHz(data: Uint8Array): number {
  if (data.length < 4) return 0;
  const hex = Array.from(data.subarray(0, 4))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const n = Number.parseInt(hex, 16);
  return Number.isFinite(n) ? n : 0;
}

export function encodeBcdFrequencyHz(hz: number): Uint8Array {
  const hex = Math.max(0, Math.round(hz)).toString(16).padStart(8, '0').slice(-8);
  const out = new Uint8Array(4);
  for (let i = 0; i < 4; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16) & 0xff;
  }
  return out;
}
