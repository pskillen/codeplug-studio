import { describe, expect, it } from 'vitest';
import {
  abbreviateWord,
  isStopword,
  matchPhraseAbbreviation,
  matchWordCasing,
} from './abbreviations.ts';

describe('abbreviateWord', () => {
  it('returns progressive forms for a known term', () => {
    expect(abbreviateWord('Scotland', 0)).toBe('Scot');
    expect(abbreviateWord('Scotland', 1)).toBe('Sco');
    expect(abbreviateWord('Scotland', 2)).toBe('Sc');
  });

  it('is case-insensitive for lookup and preserves input casing', () => {
    expect(abbreviateWord('glasgow', 0)).toBe('glas');
    expect(abbreviateWord('Glasgow', 0)).toBe('Glas');
    expect(abbreviateWord('GLASGOW', 0)).toBe('GLAS');
  });

  it('clamps level to the shortest available form', () => {
    expect(abbreviateWord('West', 99)).toBe('W');
  });

  it('returns the original word when not in the dictionary', () => {
    expect(abbreviateWord('Largs', 0)).toBe('Largs');
  });

  it('returns the original word for negative levels', () => {
    expect(abbreviateWord('Scotland', -1)).toBe('Scotland');
  });

  it('handles multi-word dictionary keys as single tokens', () => {
    expect(abbreviateWord('Northern Ireland', 0)).toBe('N Ire');
    expect(abbreviateWord('Talk In', 1)).toBe('TI');
  });
});

describe('matchPhraseAbbreviation', () => {
  it('matches multi-token phrases in a token array', () => {
    const tokens = ['GB7GL', 'United', 'Kingdom'];
    expect(matchPhraseAbbreviation(tokens, 1, 0)).toEqual({ span: 2, replacement: 'UK' });
    expect(matchPhraseAbbreviation(tokens, 0, 0)).toBeNull();
  });

  it('prefers the longest matching phrase', () => {
    const tokens = ['Northern', 'Ireland', 'Chat'];
    expect(matchPhraseAbbreviation(tokens, 0, 0)).toEqual({ span: 2, replacement: 'N Ire' });
  });

  it('skips spans that include protected tokens', () => {
    const tokens = ['GB7AC', 'United', 'Kingdom'];
    expect(matchPhraseAbbreviation(tokens, 0, 0, (t) => t === 'GB7AC')).toBeNull();
    expect(matchPhraseAbbreviation(tokens, 1, 0, (t) => t === 'GB7AC')).toEqual({
      span: 2,
      replacement: 'UK',
    });
  });
});

describe('isStopword', () => {
  it('matches stopwords case-insensitively', () => {
    expect(isStopword('the')).toBe(true);
    expect(isStopword('The')).toBe(true);
    expect(isStopword('AND')).toBe(true);
    expect(isStopword('&')).toBe(true);
  });

  it('rejects non-stopwords', () => {
    expect(isStopword('Scotland')).toBe(false);
    expect(isStopword('GB7GL')).toBe(false);
  });
});

describe('matchWordCasing', () => {
  it('applies title, upper, and lower casing', () => {
    expect(matchWordCasing('Scotland', 'sco')).toBe('Sco');
    expect(matchWordCasing('SCOTLAND', 'sco')).toBe('SCO');
    expect(matchWordCasing('scotland', 'Sco')).toBe('sco');
  });
});
