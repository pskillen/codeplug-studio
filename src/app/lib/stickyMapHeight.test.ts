import { describe, expect, it } from 'vitest';
import { stickyMapHeight } from './stickyMapHeight.ts';

describe('stickyMapHeight', () => {
  it('fills the first screen below the chrome', () => {
    expect(stickyMapHeight(900, 224)).toBe(664);
  });
  it('never exceeds the viewport minus gutters', () => {
    expect(stickyMapHeight(900, 0)).toBe(876);
  });
  it('keeps a usable minimum on short viewports', () => {
    expect(stickyMapHeight(500, 400)).toBe(360);
  });
});
