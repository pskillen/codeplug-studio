import { describe, expect, it } from 'vitest';
import {
  formatChirpSkipColumn,
  formatOpenGd77AllSkip,
  parseChirpSkipColumn,
  parseOpenGd77AllSkip,
} from './wire.ts';

describe('CHIRP Skip wire', () => {
  it('formats skip vs scan', () => {
    expect(formatChirpSkipColumn('skip')).toBe('S');
    expect(formatChirpSkipColumn('scan')).toBe('');
  });

  it('parses S as skip and blank as default', () => {
    expect(parseChirpSkipColumn('S')).toBe('skip');
    expect(parseChirpSkipColumn('')).toBe('default');
    expect(parseChirpSkipColumn('P')).toBe('default');
  });
});

describe('OpenGD77 All Skip wire', () => {
  it('formats skip as true for wireYesNo', () => {
    expect(formatOpenGd77AllSkip('skip')).toBe(true);
    expect(formatOpenGd77AllSkip('scan')).toBe(false);
  });

  it('parses yes/no to scanInclusion', () => {
    expect(parseOpenGd77AllSkip('Yes')).toBe('skip');
    expect(parseOpenGd77AllSkip('No')).toBe('default');
  });
});
