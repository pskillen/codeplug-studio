import { describe, expect, it } from 'vitest';
import { colorForLayer } from './layerColor.ts';

describe('colorForLayer', () => {
  it('returns the shared hex colour for each ionospheric layer', () => {
    expect(colorForLayer('D')).toBe('#5ec8ff');
    expect(colorForLayer('E')).toBe('#3ddc97');
    expect(colorForLayer('F1')).toBe('#f5c451');
    expect(colorForLayer('F2')).toBe('#ff6b6b');
  });
});
