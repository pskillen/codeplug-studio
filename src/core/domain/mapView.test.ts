import { describe, expect, it } from 'vitest';
import { collectMapPoints, computeMapView } from './mapView.ts';

describe('computeMapView', () => {
  it('returns null for no points', () => {
    expect(computeMapView([], { padding: [48, 48], maxZoom: 11, singlePointZoom: 11 })).toBeNull();
  });

  it('uses setView for a single point instead of fitBounds', () => {
    expect(
      computeMapView([[56.5, -4.0]], { padding: [48, 48], maxZoom: 11, singlePointZoom: 11 }),
    ).toEqual({
      type: 'setView',
      center: [56.5, -4.0],
      zoom: 11,
    });
  });

  it('uses fitBounds when points span an area', () => {
    expect(
      computeMapView(
        [
          [56.0, -4.0],
          [57.0, -3.0],
        ],
        { padding: [48, 48], maxZoom: 11, singlePointZoom: 11 },
      ),
    ).toEqual({
      type: 'fitBounds',
      southWest: [56.0, -4.0],
      northEast: [57.0, -3.0],
      padding: [48, 48],
      maxZoom: 11,
    });
  });
});

describe('collectMapPoints', () => {
  it('collects marker and optional zone points', () => {
    const groups = [
      [{ location: { lat: 56.5, lon: -4.0 } }],
      [{ location: { lat: 57.0, lon: -3.5 } }],
    ];
    expect(collectMapPoints(groups, [[56.5, -4.0]], true)).toHaveLength(3);
    expect(collectMapPoints(groups, [[56.5, -4.0]], false)).toHaveLength(2);
  });

  it('includes extra points such as operator position', () => {
    const groups = [[{ location: { lat: 56.5, lon: -4.0 } }]];
    expect(collectMapPoints(groups, [], false, [[55.9, -4.2]])).toEqual([
      [56.5, -4.0],
      [55.9, -4.2],
    ]);
  });
});
