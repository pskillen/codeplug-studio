import { describe, expect, it } from 'vitest';
import { sanitiseAsciiWireString } from './sanitiseAsciiWireString.ts';

describe('sanitiseAsciiWireString', () => {
  it('leaves ASCII strings unchanged', () => {
    expect(sanitiseAsciiWireString('GB7GL Glasgow')).toBe('GB7GL Glasgow');
  });

  it('replaces em and en dashes with hyphen', () => {
    expect(sanitiseAsciiWireString('GB7AC \u2014 BrandMeister')).toBe('GB7AC - BrandMeister');
    expect(sanitiseAsciiWireString('A\u2013B')).toBe('A-B');
  });

  it('replaces curly quotes with straight quotes', () => {
    expect(sanitiseAsciiWireString('\u201Ctest\u201D')).toBe('"test"');
  });

  it('strips remaining non-ASCII characters', () => {
    expect(sanitiseAsciiWireString('caf\u00E9')).toBe('caf');
    expect(sanitiseAsciiWireString('\u00A0padded')).toBe('padded');
  });
});
