import { describe, expect, it } from 'vitest';
import { colorForLayer } from './layerColor.ts';

describe('colorForLayer', () => {
  it('returns a distinct hex colour for each ionospheric layer', () => {
    const colors = (['D', 'E', 'F1', 'F2'] as const).map(colorForLayer);
    expect(new Set(colors).size).toBe(4);
    for (const color of colors) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
