import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { LatLon } from '@core/domain/geo.ts';
import SatelliteLiveMap from './SatelliteLiveMap.tsx';

const ISS_LINE_1 = '1 25544U 98067A   24045.51782528  .00016717 00000-0   30589-3 0  9993';
const ISS_LINE_2 = '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.4956032 430001';
const ISS_MEAN_MOTION_REV_PER_DAY = 15.4956032;

const mockUseLiveSatellitePosition = vi.fn();
vi.mock('../../routes/tracking/useLiveSatellitePosition.ts', () => ({
  useLiveSatellitePosition: (...args: unknown[]) => mockUseLiveSatellitePosition(...args),
}));

const mockComputeSatelliteFootprint = vi.fn();
vi.mock('@core/domain/satelliteTracking/footprint.ts', async () => {
  const actual = await vi.importActual<
    typeof import('@core/domain/satelliteTracking/footprint.ts')
  >('@core/domain/satelliteTracking/footprint.ts');
  return {
    ...actual,
    computeSatelliteFootprint: (...args: unknown[]) => mockComputeSatelliteFootprint(...args),
  };
});

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => null,
  Marker: ({ position }: { position: [number, number] }) => (
    <div data-testid="live-marker" data-position={JSON.stringify(position)} />
  ),
  Polygon: ({ positions }: { positions: LatLon[] }) => (
    <div data-testid="footprint-segment" data-positions={JSON.stringify(positions)} />
  ),
  Polyline: ({ pathOptions }: { pathOptions: { dashArray?: string } }) => (
    <div data-testid={pathOptions.dashArray ? 'past-trail-segment' : 'future-trail-segment'} />
  ),
  useMap: () => ({
    setView: vi.fn(),
    fitBounds: vi.fn(),
  }),
}));

const NON_CROSSING_FOOTPRINT = {
  center: [10, 20] as LatLon,
  altitudeKm: 420,
  angularRadiusDeg: 20,
  points: [
    [0, 10],
    [5, 15],
    [0, 20],
    [-5, 15],
    [0, 10],
  ] as LatLon[],
};

// A rectangular ring straddling the antimeridian — crosses it once eastbound, once
// westbound (same fixture shape as mapHelpers.test.ts's splitRingAtAntimeridian case).
const ANTIMERIDIAN_CROSSING_FOOTPRINT = {
  center: [0, 180] as LatLon,
  altitudeKm: 420,
  angularRadiusDeg: 20,
  points: [
    [10, 170],
    [10, -170],
    [-10, -170],
    [-10, 170],
    [10, 170],
  ] as LatLon[],
};

describe('SatelliteLiveMap', () => {
  it('renders the live marker, footprint circle, and both trail segments', () => {
    mockUseLiveSatellitePosition.mockReturnValue({
      position: [10, 20],
      altitudeKm: 420,
      at: '2024-02-14T18:00:00.000Z',
    });
    mockComputeSatelliteFootprint.mockReturnValue(NON_CROSSING_FOOTPRINT);

    render(
      <SatelliteLiveMap
        satelliteName="ISS"
        tleLine1={ISS_LINE_1}
        tleLine2={ISS_LINE_2}
        meanMotionRevPerDay={ISS_MEAN_MOTION_REV_PER_DAY}
      />,
    );

    expect(screen.getByTestId('live-marker')).toHaveAttribute(
      'data-position',
      JSON.stringify([10, 20]),
    );
    expect(screen.getAllByTestId('footprint-segment').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('future-trail-segment').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('past-trail-segment').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Acquiring live position/)).not.toBeInTheDocument();
  });

  it('shows an acquiring-position hint and no marker before the first live position resolves', () => {
    mockUseLiveSatellitePosition.mockReturnValue(null);

    render(
      <SatelliteLiveMap
        satelliteName="ISS"
        tleLine1={ISS_LINE_1}
        tleLine2={ISS_LINE_2}
        meanMotionRevPerDay={ISS_MEAN_MOTION_REV_PER_DAY}
      />,
    );

    expect(screen.getByText('Acquiring live position for ISS…')).toBeInTheDocument();
    expect(screen.queryByTestId('live-marker')).not.toBeInTheDocument();
    expect(screen.queryByTestId('footprint-segment')).not.toBeInTheDocument();
    // Trail segments don't depend on the live position, so they still render.
    expect(screen.getAllByTestId('future-trail-segment').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('past-trail-segment').length).toBeGreaterThan(0);
  });

  it('splits a footprint that crosses the antimeridian into closed, world-copy-duplicated fragments', () => {
    mockUseLiveSatellitePosition.mockReturnValue({
      position: [0, 180],
      altitudeKm: 420,
      at: '2024-02-14T18:00:00.000Z',
    });
    mockComputeSatelliteFootprint.mockReturnValue(ANTIMERIDIAN_CROSSING_FOOTPRINT);

    render(
      <SatelliteLiveMap
        satelliteName="ISS"
        tleLine1={ISS_LINE_1}
        tleLine2={ISS_LINE_2}
        meanMotionRevPerDay={ISS_MEAN_MOTION_REV_PER_DAY}
      />,
    );

    // 2 antimeridian-split fragments x 3 world copies (-360/0/+360).
    const rendered = screen.getAllByTestId('footprint-segment');
    expect(rendered).toHaveLength(6);

    for (const el of rendered) {
      const positions = JSON.parse(el.getAttribute('data-positions')!) as LatLon[];
      const firstLon = positions[0]![1];
      const lastLon = positions[positions.length - 1]![1];
      // Each fragment is closed against the same antimeridian-side longitude at both ends
      // (mod the 360deg world-copy offset) — not a chord straight across the map.
      expect(Math.abs(firstLon) % 360).toBeCloseTo(180, 5);
      expect(firstLon).toBeCloseTo(lastLon, 5);
    }
  });
});
