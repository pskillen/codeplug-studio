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

const FIRST_UNIT_ERASED = 0xffff;

/**
 * A name field ends at its first NUL code unit, or at erased `0xFFFF` fill: a vacant name field must
 * not decode to replacement characters. Whatever precedes the terminator goes through the shared
 * wide-character decoder.
 */
export function decodeTerminatedWideCharName(field: Uint8Array): string {
  let end = field.length - (field.length % 2);
  for (let i = 0; i + 1 < field.length; i += 2) {
    const unit = field[i]! | (field[i + 1]! << 8);
    if (unit === 0 || unit === FIRST_UNIT_ERASED) {
      end = i;
      break;
    }
  }
  return decodeWideCharName(field.subarray(0, end));
}
