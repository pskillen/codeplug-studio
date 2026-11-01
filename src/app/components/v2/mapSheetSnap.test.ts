import { describe, expect, it } from 'vitest';
import { nextSnap, snapAfterDrag, snapForView, snapHeights, viewForSnap } from './mapSheetSnap.ts';

const heights = snapHeights(800, { peekPx: 140, fullTopInsetPx: 80 });

describe('snapHeights', () => {
  it('orders peek < half < full inside the container', () => {
    expect(heights.peek).toBe(140);
    expect(heights.half).toBe(400);
    expect(heights.full).toBe(720);
  });

  it('stays ordered in a tiny container', () => {
    const h = snapHeights(300, { peekPx: 140, fullTopInsetPx: 80 });
    expect(h.peek).toBeLessThan(h.half);
    expect(h.half).toBeLessThan(h.full);
  });
});

describe('snapAfterDrag', () => {
  it('settles on the nearest snap when released slowly', () => {
    expect(snapAfterDrag(180, heights)).toBe('peek');
    expect(snapAfterDrag(380, heights)).toBe('half');
    expect(snapAfterDrag(650, heights)).toBe('full');
  });

  it('moves one snap along on a fast flick', () => {
    expect(snapAfterDrag(150, heights, 1)).toBe('half');
    expect(snapAfterDrag(420, heights, 1)).toBe('full');
    expect(snapAfterDrag(400, heights, -1)).toBe('peek');
    expect(snapAfterDrag(700, heights, -1)).toBe('half');
  });

  it('clamps flicks at the ends', () => {
    expect(snapAfterDrag(720, heights, 1)).toBe('full');
    expect(snapAfterDrag(140, heights, -1)).toBe('peek');
  });
});

describe('Map | List toggle', () => {
  it('maps views to snaps and back', () => {
    expect(snapForView('map')).toBe('peek');
    expect(snapForView('list')).toBe('full');
    expect(viewForSnap('peek')).toBe('map');
    expect(viewForSnap('half')).toBe('map');
    expect(viewForSnap('full')).toBe('list');
  });

  it('cycles on handle tap', () => {
    expect(nextSnap('peek')).toBe('half');
    expect(nextSnap('half')).toBe('full');
    expect(nextSnap('full')).toBe('peek');
  });
});
