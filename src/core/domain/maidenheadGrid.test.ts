import { describe, expect, it } from 'vitest';
import { coordsToLocator } from './maidenhead.ts';
import {
  activeGridDetail,
  computeGridLabels,
  computeGridLines,
  MIN_ZOOM_FOR_6_DETAIL,
} from './maidenheadGrid.ts';

/** Glasgow area viewport. */
const glasgowBounds = {
  south: 55.5,
  west: -5.0,
  north: 56.2,
  east: -3.8,
};

describe('maidenheadGrid', () => {
  it('returns no lines or labels when mode is off', () => {
    expect(computeGridLines(glasgowBounds, 'off')).toEqual([]);
    expect(computeGridLabels(glasgowBounds, 'off')).toEqual([]);
  });

  it('draws 4-char grid lines at 2° / 1° spacing', () => {
    const lines = computeGridLines(glasgowBounds, '4', 0);
    const lons = lines.flatMap((l) => l.positions.map((p) => p[1]));
    expect(lines.some((l) => l.level === 4)).toBe(true);
    expect(lines.every((l) => l.level === 4)).toBe(true);
    expect(lons.some((lon) => Math.abs(lon - -6) < 0.001)).toBe(true);
    expect(lons.some((lon) => Math.abs(lon - -4) < 0.001)).toBe(true);
  });

  it('activeGridDetail respects max setting and zoom thresholds', () => {
    expect(activeGridDetail('4', 6)).toBe(4);
    expect(activeGridDetail('6', 6)).toBe(4);
    expect(activeGridDetail('6', MIN_ZOOM_FOR_6_DETAIL)).toBe(6);
  });

  it('adds finer lines progressively up to max resolution', () => {
    const low = computeGridLines(glasgowBounds, '6', 0, 6);
    expect(low.every((l) => l.level === 4)).toBe(true);

    const high = computeGridLines(glasgowBounds, '6', 0, MIN_ZOOM_FOR_6_DETAIL);
    expect(high.some((l) => l.level === 4)).toBe(true);
    expect(high.some((l) => l.level === 6)).toBe(true);
    expect(high.every((l) => l.level <= 6)).toBe(true);
  });

  it('labels only the active precision level', () => {
    const low = computeGridLabels(glasgowBounds, '6', 0, 6);
    expect(low.every((l) => l.text.length === 4)).toBe(true);

    const high = computeGridLabels(glasgowBounds, '6', 0, MIN_ZOOM_FOR_6_DETAIL);
    expect(high.every((l) => l.text.length === 6)).toBe(true);
  });

  it('labels match coordsToLocator at active precision', () => {
    const labels = computeGridLabels(glasgowBounds, '4', 0, 6);
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.some((l) => l.text.startsWith('IO'))).toBe(true);
    for (const label of labels) {
      expect(label.text).toBe(coordsToLocator(label.position[0], label.position[1], 4));
    }
  });

  it('clamps latitude at poles in padded bounds', () => {
    const polarBounds = { south: 88, west: 0, north: 89.5, east: 10 };
    expect(() => computeGridLines(polarBounds, '4')).not.toThrow();
    expect(() => computeGridLabels(polarBounds, '4')).not.toThrow();
  });
});
