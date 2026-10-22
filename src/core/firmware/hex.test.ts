import { describe, expect, it } from 'vitest';

import { FirmwareError } from './errors.ts';
import { bytesToHex, hexToBytes } from './hex.ts';

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    return e instanceof FirmwareError ? e.code : 'not-firmware-error';
  }
  return undefined;
}

describe('hex', () => {
  it('round-trips bytes, accepting either case', () => {
    const bytes = new Uint8Array([0, 1, 0x7f, 0x80, 0xab, 0xff]);
    expect(bytesToHex(bytes)).toBe('00017f80abff');
    expect(hexToBytes('00017f80abff')).toEqual(bytes);
    expect(hexToBytes('00017F80ABFF')).toEqual(bytes);
    expect(hexToBytes('')).toEqual(new Uint8Array(0));
  });

  it('refuses odd length, non-hex characters and whitespace', () => {
    expect(codeOf(() => hexToBytes('abc'))).toBe('patch-malformed');
    expect(codeOf(() => hexToBytes('zz'))).toBe('patch-malformed');
    expect(codeOf(() => hexToBytes('ab cd'))).toBe('patch-malformed');
    expect(codeOf(() => hexToBytes(' abcd'))).toBe('patch-malformed');
    expect(codeOf(() => hexToBytes('0x12'))).toBe('patch-malformed');
  });
});
