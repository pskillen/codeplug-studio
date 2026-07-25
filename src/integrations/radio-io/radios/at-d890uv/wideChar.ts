/**
 * D890 wide-char name packing (UTF-16 LE code units + null padding).
 * Cite: anytone-cps `Format::wideCharString` behaviour (facts only).
 */

const TD = new TextDecoder('utf-16le', { fatal: false });

/** Encode ASCII/latin wire name to wide-char bytes (2 bytes per char). */
export function encodeWideCharName(name: string, byteLength: number): Uint8Array {
  const out = new Uint8Array(byteLength);
  out.fill(0);
  const trimmed = name.slice(0, Math.floor(byteLength / 2));
  const units = new Uint16Array(trimmed.length);
  for (let i = 0; i < trimmed.length; i++) {
    units[i] = trimmed.charCodeAt(i) & 0xffff;
  }
  out.set(new Uint8Array(units.buffer), 0);
  return out;
}

export function decodeWideCharName(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';
  const even = bytes.length - (bytes.length % 2);
  const text = TD.decode(bytes.subarray(0, even));
  return text.replace(/\0/g, '').trim();
}
