import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { LatLon } from '@core/domain/geo.ts';
import type { RayPathResult } from '@core/domain/hfPropagation/types.ts';
import { MODE_COLORS } from '../HfPropagationGlobe/buildGlobeData.ts';
import PropagationTopDownMap from './PropagationTopDownMap.tsx';

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => null,
  Marker: ({ position }: { position: [number, number] }) => (
    <div data-testid="tx-marker" data-position={JSON.stringify(position)} />
  ),
  Polyline: ({
    positions,
    pathOptions,
  }: {
    positions: LatLon[];
    pathOptions: { color: string; dashArray?: string; weight: number };
  }) => (
    <div
      data-testid={pathOptions.dashArray ? 'skip-zone-ring' : 'polyline'}
      data-color={pathOptions.color}
      data-point-count={positions.length}
    />
  ),
  useMap: () => ({
    setView: vi.fn(),
    fitBounds: vi.fn(),
    invalidateSize: vi.fn(),
    getContainer: () => {
      const parent = document.createElement('div');
      const container = document.createElement('div');
      parent.appendChild(container);
      return container;
    },
  }),
}));

const skywave: RayPathResult = {
  mode: 'skywave',
  takeoffAngleDeg: 20,
  relativeSignalStrength: 0.8,
  points: [
    { lat: 51.5, lon: -0.13, altitudeKm: 0 },
    { lat: 52, lon: 1, altitudeKm: 250 },
    { lat: 53, lon: 2, altitudeKm: 0 },
  ],
};

describe('PropagationTopDownMap', () => {
  it('centres a transmitter marker on the given lat/lon', () => {
    render(
      <PropagationTopDownMap transmitter={{ lat: 51.5, lon: -0.13 }} rays={[skywave]} />,
    );

    expect(screen.getByTestId('map-container')).toBeInTheDocument();
    expect(screen.getByTestId('tx-marker')).toHaveAttribute(
      'data-position',
      JSON.stringify([51.5, -0.13]),
    );
  });

  it('draws a groundwave ring, skip-zone ring, and first-ray track in mode colour', () => {
    render(
      <PropagationTopDownMap transmitter={{ lat: 51.5, lon: -0.13 }} rays={[skywave]} />,
    );

    expect(screen.getByTestId('skip-zone-ring')).toBeInTheDocument();
    const lines = screen.getAllByTestId('polyline');
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines.some((el) => el.getAttribute('data-color') === MODE_COLORS.skywave)).toBe(true);
    expect(lines.some((el) => el.getAttribute('data-color') === MODE_COLORS.groundwave)).toBe(
      true,
    );
  });
});
