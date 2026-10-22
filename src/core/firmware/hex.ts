import { FirmwareError } from './errors.ts';

const HEX_RE = /^[0-9a-fA-F]*$/;

/** Strict hex decode: `[0-9a-fA-F]` only, even length. Anything else is a malformed patch. */
export function hexToBytes(hex: string): Uint8Array {
  if (typeof hex !== 'string' || hex.length % 2 !== 0 || !HEX_RE.test(hex)) {
    throw new FirmwareError('patch-malformed', 'The patch file contains invalid hex data.');
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** Lowercase hex encode. */
export function bytesToHex(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}
