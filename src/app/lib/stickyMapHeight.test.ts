import { describe, expect, it } from 'vitest';
import { stickyMapHeight } from './stickyMapHeight.ts';

describe('stickyMapHeight', () => {
  it('fills the first screen below the chrome', () => {
    expect(stickyMapHeight(900, 224)).toBe(664);
  });
  it('never exceeds the viewport minus gutters', () => {
    expect(stickyMapHeight(900, 0)).toBe(876);
  });
  it('uses the full height for a pane that starts below the fold', () => {
    expect(stickyMapHeight(900, 800)).toBe(876);
  });
  it('keeps a usable minimum on short viewports', () => {
    expect(stickyMapHeight(300, 100)).toBe(360);
  });
});
