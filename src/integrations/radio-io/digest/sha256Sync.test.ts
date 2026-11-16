import { describe, expect, it } from 'vitest';

import { sha256Hex } from '@core/firmware/hash.ts';

import { sha256HexSync } from './sha256Sync.ts';

describe('sha256HexSync', () => {
  it('matches Web Crypto across padding boundaries', async () => {
    for (const n of [0, 1, 55, 56, 57, 63, 64, 65, 119, 120, 1000, 5000]) {
      const b = new Uint8Array(n).map((_, i) => (i * 31 + n) & 0xff);
      expect(sha256HexSync(b)).toBe(await sha256Hex(b));
    }
  });
  it('knows the empty-input vector', () => {
    expect(sha256HexSync(new Uint8Array())).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });
});
