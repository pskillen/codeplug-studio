/**
 * BCD-as-hex frequency packing used by Anytone D890 channel records.
 *
 * Wire: 4 bytes whose hex digit string is a decimal integer in **10 Hz** units
 * (CPS `toHex().toInt()` / `fromHex(QString::number(...))`). Studio uses Hz.
 */

export function decodeBcdFrequencyHz(data: Uint8Array): number {
  if (data.length < 4) return 0;
  const digits = Array.from(data.subarray(0, 4))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  if (!/^\d{8}$/.test(digits)) return 0;
  const units10Hz = Number.parseInt(digits, 10);
  return Number.isFinite(units10Hz) ? units10Hz * 10 : 0;
}

export function encodeBcdFrequencyHz(hz: number): Uint8Array {
  const units10Hz = Math.max(0, Math.round(hz / 10));
  const digits = String(units10Hz).padStart(8, '0').slice(-8);
  const out = new Uint8Array(4);
  for (let i = 0; i < 4; i++) {
    out[i] = Number.parseInt(digits.slice(i * 2, i * 2 + 2), 16) & 0xff;
  }
  return out;
}
