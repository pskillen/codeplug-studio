import { describe, expect, it } from 'vitest';
import { formatCtcssHz } from './tones.ts';

describe('formatCtcssHz', () => {
  it.each([
    [100, '100.0'],
    [110.9, '110.9'],
    [88.5, '88.5'],
  ] as const)('formats %s as %s', (hz, expected) => {
    expect(formatCtcssHz(hz)).toBe(expected);
  });

  it('returns none for non-positive values', () => {
    expect(formatCtcssHz(0)).toBe('none');
    expect(formatCtcssHz(-1)).toBe('none');
  });
});
