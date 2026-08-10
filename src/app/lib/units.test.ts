import { describe, expect, it } from 'vitest';
import {
  hzToMhzString,
  mhzStringToHz,
  optionalNumberToString,
  parseOptionalFloat,
  parseOptionalInt,
} from './units.ts';

describe('mhzStringToHz', () => {
  it('parses a valid MHz value to Hz', () => {
    expect(mhzStringToHz('145.825')).toBe(145_825_000);
  });

  it('returns null for blank input', () => {
    expect(mhzStringToHz('')).toBeNull();
    expect(mhzStringToHz('   ')).toBeNull();
  });

  it('returns null for non-numeric input', () => {
    expect(mhzStringToHz('abc')).toBeNull();
  });

  it('rejects zero and negative frequencies', () => {
    expect(mhzStringToHz('0')).toBeNull();
    expect(mhzStringToHz('-145.825')).toBeNull();
  });

  it('rejects absurdly large frequencies', () => {
    expect(mhzStringToHz('999999999')).toBeNull();
  });

  it('accepts the sanity ceiling boundary', () => {
    expect(mhzStringToHz('300000')).toBe(300_000_000_000);
  });
});

describe('hzToMhzString / mhzStringToHz round-trip', () => {
  it('round-trips a typical VHF frequency', () => {
    const hz = mhzStringToHz('145.825');
    expect(hz).not.toBeNull();
    expect(mhzStringToHz(hzToMhzString(hz))).toBe(hz);
  });
});

describe('parseOptionalFloat', () => {
  it('parses a valid tone value', () => {
    expect(parseOptionalFloat('88.5')).toBe(88.5);
  });

  it('returns null for blank input', () => {
    expect(parseOptionalFloat('')).toBeNull();
    expect(parseOptionalFloat('   ')).toBeNull();
  });

  it('returns null for non-numeric input', () => {
    expect(parseOptionalFloat('xyz')).toBeNull();
  });

  it('rejects zero and negative values', () => {
    expect(parseOptionalFloat('0')).toBeNull();
    expect(parseOptionalFloat('-88.5')).toBeNull();
  });

  it('rejects absurdly large values', () => {
    expect(parseOptionalFloat('99999999')).toBeNull();
  });
});

describe('parseOptionalInt', () => {
  it('parses and truncates a valid value', () => {
    expect(parseOptionalInt('42.9')).toBe(42);
  });

  it('returns null for blank or non-numeric input', () => {
    expect(parseOptionalInt('')).toBeNull();
    expect(parseOptionalInt('abc')).toBeNull();
  });
});

describe('optionalNumberToString', () => {
  it('formats a number and passes through null/undefined as empty string', () => {
    expect(optionalNumberToString(88.5)).toBe('88.5');
    expect(optionalNumberToString(null)).toBe('');
    expect(optionalNumberToString(undefined)).toBe('');
  });
});
