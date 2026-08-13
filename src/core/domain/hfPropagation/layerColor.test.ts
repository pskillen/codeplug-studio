import { describe, expect, it } from 'vitest';
import { colorForLayer } from './layerColor.ts';

describe('colorForLayer', () => {
  it('returns the shared hex colour for each ionospheric layer', () => {
    expect(colorForLayer('D')).toBe('#ff6b6b');
    expect(colorForLayer('E')).toBe('#f5c451');
    expect(colorForLayer('F1')).toBe('#3ddc97');
    expect(colorForLayer('F2')).toBe('#5ec8ff');
  });
});
