import { describe, expect, it } from 'vitest';
import {
  canonicalDcsChannelTone,
  formatCtcssHz,
  formatDcsChannelTone,
  parseChannelTone,
} from './tones.ts';

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

describe('parseChannelTone', () => {
  it('treats blank and none as off', () => {
    expect(parseChannelTone(undefined)).toEqual({ kind: 'none' });
    expect(parseChannelTone('')).toEqual({ kind: 'none' });
    expect(parseChannelTone(' none ')).toEqual({ kind: 'none' });
  });

  it('parses CTCSS Hz', () => {
    expect(parseChannelTone('88.5')).toEqual({ kind: 'ctcss', hz: 88.5 });
    expect(parseChannelTone('100')).toEqual({ kind: 'ctcss', hz: 100 });
  });

  it('parses normal and inverted DCS, including legacy P', () => {
    expect(parseChannelTone('D023N')).toEqual({ kind: 'dcs', code: 23, polarity: 'N' });
    expect(parseChannelTone('D023I')).toEqual({ kind: 'dcs', code: 23, polarity: 'I' });
    expect(parseChannelTone('D047P')).toEqual({ kind: 'dcs', code: 47, polarity: 'I' });
    expect(parseChannelTone('d023i')).toEqual({ kind: 'dcs', code: 23, polarity: 'I' });
  });

  it('leaves an unrecognised string unknown', () => {
    expect(parseChannelTone('not-a-tone')).toEqual({ kind: 'unknown' });
  });
});

describe('canonicalDcsChannelTone', () => {
  it('rewrites a legacy P suffix to I and leaves other tones', () => {
    expect(formatDcsChannelTone(23, 'I')).toBe('D023I');
    expect(canonicalDcsChannelTone('D047P')).toBe('D047I');
    expect(canonicalDcsChannelTone('D023I')).toBe('D023I');
    expect(canonicalDcsChannelTone('D023N')).toBe('D023N');
    expect(canonicalDcsChannelTone('88.5')).toBe('88.5');
    expect(canonicalDcsChannelTone('none')).toBe('none');
  });
});
