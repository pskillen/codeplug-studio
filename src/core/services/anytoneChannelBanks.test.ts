import { describe, expect, it } from 'vitest';
import { usesAtD890AirbandBankSplit } from './anytoneChannelBanks.ts';

describe('usesAtD890AirbandBankSplit', () => {
  it('is true for D890 CSV and Web Serial egress profiles', () => {
    expect(usesAtD890AirbandBankSplit('anytone-at-d890uv')).toBe(true);
    expect(usesAtD890AirbandBankSplit('radio-io-at-d890uv')).toBe(true);
  });

  it('is false for other radio targets and missing profile', () => {
    expect(usesAtD890AirbandBankSplit(undefined)).toBe(false);
    expect(usesAtD890AirbandBankSplit('opengd77-1701')).toBe(false);
    expect(usesAtD890AirbandBankSplit('radio-io-opengd77-1701')).toBe(false);
    expect(usesAtD890AirbandBankSplit('chirp-uv5r')).toBe(false);
  });
});
