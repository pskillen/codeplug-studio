import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SatelliteLiveMap from './SatelliteLiveMap.tsx';

const ISS_LINE_1 = '1 25544U 98067A   24045.51782528  .00016717 00000-0   30589-3 0  9993';
const ISS_LINE_2 = '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.4956032 430001';
const ISS_MEAN_MOTION_REV_PER_DAY = 15.4956032;

const mockUseLiveSatellitePosition = vi.fn();
vi.mock('../../routes/tracking/useLiveSatellitePosition.ts', () => ({
  useLiveSatellitePosition: (...args: unknown[]) => mockUseLiveSatellitePosition(...args),
}));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => null,
  Marker: ({ position }: { position: [number, number] }) => (
    <div data-testid="live-marker" data-position={JSON.stringify(position)} />
  ),
  Polygon: () => <div data-testid="footprint-segment" />,
  Polyline: ({ pathOptions }: { pathOptions: { dashArray?: string } }) => (
    <div data-testid={pathOptions.dashArray ? 'past-trail-segment' : 'future-trail-segment'} />
  ),
  useMap: () => ({
    setView: vi.fn(),
    fitBounds: vi.fn(),
  }),
}));

describe('SatelliteLiveMap', () => {
  it('renders the live marker, footprint circle, and both trail segments', () => {
    mockUseLiveSatellitePosition.mockReturnValue({
      position: [10, 20],
      altitudeKm: 420,
      at: '2024-02-14T18:00:00.000Z',
    });

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
});
