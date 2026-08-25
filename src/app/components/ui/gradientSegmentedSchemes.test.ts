import { describe, expect, it } from 'vitest';
import { segmentColorsForOptions, THREE_SEGMENT_SCHEME } from './gradientSegmentedSchemes.ts';

describe('segmentColorsForOptions', () => {
  it('fits the palette to non-neutral values only, leaving neutral positions null', () => {
    const colors = segmentColorsForOptions(
      THREE_SEGMENT_SCHEME,
      ['default', 'permitAlways', 'busyLock'],
      ['default'],
    );
    expect(colors).toEqual([null, 'blue', 'yellow']);
  });

  it('does not collapse a semantically distinct option onto the neutral padding colour (#regression)', () => {
    // Two-colour scheme + one neutral value inserted: positional padding used to repeat
    // the scheme's last colour onto the neutral slot too, making it indistinguishable
    // from whichever real option landed there.
    const twoColorScheme = { segmentColors: ['teal', 'orange'] };
    const colors = segmentColorsForOptions(
      twoColorScheme,
      ['default', 'allow', 'forbid'],
      ['default'],
    );
    expect(colors).toEqual([null, 'teal', 'orange']);
  });

  it('supports a differently-spelled neutral value', () => {
    const colors = segmentColorsForOptions(
      THREE_SEGMENT_SCHEME,
      ['auto', 'dmo-simplex', 'repeater'],
      ['auto'],
    );
    expect(colors).toEqual([null, 'blue', 'yellow']);
  });

  it('behaves like plain palette fitting when no value is neutral', () => {
    const colors = segmentColorsForOptions(THREE_SEGMENT_SCHEME, ['a', 'b', 'c'], []);
    expect(colors).toEqual(['blue', 'yellow', 'orange']);
  });
});
