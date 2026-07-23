import { describe, expect, it } from 'vitest';
import { UV5R_MINI_DEFAULT_ENCRSYM, UV5R_MINI_MEM_TOTAL } from './constants.ts';
import { uv5rMiniCrypt } from './crypt.ts';
import {
  createBlankSyntheticImage,
  createSyntheticImageBase,
} from './__fixtures__/syntheticImage.ts';

describe('uv5rMiniCrypt', () => {
  it('round-trips arbitrary payload with default encrsym', () => {
    const plain = new Uint8Array(64);
    for (let i = 0; i < 64; i++) plain[i] = (i * 7 + 3) & 0xff;
    const once = uv5rMiniCrypt(plain, UV5R_MINI_DEFAULT_ENCRSYM);
    const twice = uv5rMiniCrypt(once, UV5R_MINI_DEFAULT_ENCRSYM);
    expect(twice).toEqual(plain);
  });

  it('leaves 0x00 and 0xFF unchanged under default symbol', () => {
    const plain = new Uint8Array([0x00, 0xff, 0x00, 0xff]);
    expect(uv5rMiniCrypt(plain)).toEqual(plain);
  });

  it('transforms non-sentinel bytes for encrsym 1', () => {
    // Symbol 1 = CO 7 → 0x43,0x4F,0x20,0x37; space at index 2 skips XOR
    const plain = new Uint8Array([0x11, 0x22, 0x33, 0x44]);
    const out = uv5rMiniCrypt(plain, 1);
    expect(out[0]).toBe(0x11 ^ 0x43);
    expect(out[1]).toBe(0x22 ^ 0x4f);
    expect(out[2]).toBe(0x33); // space — no xor
    expect(out[3]).toBe(0x44 ^ 0x37);
  });
});

describe('synthetic image fixture', () => {
  it('allocates MEM_TOTAL filled with 0xFF', () => {
    const image = createBlankSyntheticImage();
    expect(image.length).toBe(UV5R_MINI_MEM_TOTAL);
    expect(image.every((b) => b === 0xff)).toBe(true);
  });

  it('writes a printable firmware string at 0x1EF0', () => {
    const image = createSyntheticImageBase();
    const slice = image.subarray(0x1ef0, 0x1ef0 + 12);
    expect(String.fromCharCode(...slice)).toBe('UV5RMINI-TES');
  });
});
