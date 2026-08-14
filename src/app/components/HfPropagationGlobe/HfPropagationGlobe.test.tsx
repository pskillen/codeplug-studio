import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { IonosphericLayerState, RayPathResult } from '@core/domain/hfPropagation/types.ts';
import HfPropagationGlobe, { GLOBE_RADIUS_UNITS, shellRadiusUnits } from './HfPropagationGlobe.tsx';
import { GLOBE_EARTH_RADIUS_KM } from '../SatelliteGlobe/globeAltitude.ts';
import { MODE_COLORS } from './buildGlobeData.ts';

// react-globe.gl needs a WebGL context jsdom doesn't provide, so it's mocked to a stub that
// exposes the props it was called with — same convention as SatelliteGlobe.test.tsx. This
// component's shell-mesh construction (`customThreeObject`) isn't meaningfully unit-testable
// without a real renderer, so the geometry/material math is kept in the separately-exported,
// pure `shellRadiusUnits` tested below instead.
let lastGlobeProps: Record<string, unknown> | null = null;
vi.mock('react-globe.gl', () => ({
  default: (props: Record<string, unknown>) => {
    lastGlobeProps = props;
    return <div data-testid="globe-stub" />;
  },
}));

function layer(
  id: IonosphericLayerState['id'],
  active: boolean,
  altitudeMinKm: number,
  altitudeMaxKm: number,
): IonosphericLayerState {
  return { id, active, altitudeMinKm, altitudeMaxKm, peakElectronDensity: active ? 1e12 : 0 };
}

const DAYTIME_LAYERS: IonosphericLayerState[] = [
  layer('D', true, 60, 90),
  layer('E', true, 90, 150),
  layer('F1', true, 150, 250),
  layer('F2', true, 250, 400),
];

const NIGHTTIME_LAYERS: IonosphericLayerState[] = [
  layer('D', false, 60, 90),
  layer('E', true, 90, 150),
  layer('F1', false, 150, 250),
  layer('F2', true, 250, 400),
];

describe('shellRadiusUnits', () => {
  it('returns GLOBE_RADIUS_UNITS at the surface (zero altitude)', () => {
    expect(shellRadiusUnits(0)).toBe(GLOBE_RADIUS_UNITS);
  });

  it('scales by one Earth radius of altitude', () => {
    expect(shellRadiusUnits(GLOBE_EARTH_RADIUS_KM)).toBe(GLOBE_RADIUS_UNITS * 2);
  });

  it('returns the expected multiple for the F2 layer mid-altitude', () => {
    const midAltitudeKm = (250 + 400) / 2;
    expect(shellRadiusUnits(midAltitudeKm)).toBeCloseTo(
      GLOBE_RADIUS_UNITS * (1 + midAltitudeKm / GLOBE_EARTH_RADIUS_KM),
    );
  });
});

describe('HfPropagationGlobe', () => {
  it('passes only active layers to customLayerData when no environment instant is set', () => {
    render(<HfPropagationGlobe layers={NIGHTTIME_LAYERS} />);

    expect(screen.getByTestId('globe-stub')).toBeInTheDocument();
    const shells = lastGlobeProps?.customLayerData as { id: string }[];
    expect(shells.map((s) => s.id)).toEqual(['E', 'F2']);
    expect(lastGlobeProps?.customThreeObject).toBeInstanceOf(Function);
    expect(lastGlobeProps?.customThreeObjectUpdate).toBeInstanceOf(Function);
  });

  it('passes all four layers when every layer is active', () => {
    render(<HfPropagationGlobe layers={DAYTIME_LAYERS} />);

    const shells = lastGlobeProps?.customLayerData as { id: string }[];
    expect(shells.map((s) => s.id)).toEqual(['D', 'E', 'F1', 'F2']);
  });

  it('omits operator-hidden layers even when they are physics-active', () => {
    render(
      <HfPropagationGlobe
        layers={DAYTIME_LAYERS}
        visibleLayers={{ D: true, E: true, F1: false, F2: false }}
      />,
    );

    const shells = lastGlobeProps?.customLayerData as { id: string }[];
    expect(shells.map((s) => s.id)).toEqual(['D', 'E']);
  });

  it('does not draw a physics-inactive layer when there is no environment instant', () => {
    render(
      <HfPropagationGlobe
        layers={NIGHTTIME_LAYERS}
        visibleLayers={{ D: true, E: true, F1: true, F2: true }}
      />,
    );

    const shells = lastGlobeProps?.customLayerData as { id: string }[];
    expect(shells.map((s) => s.id)).toEqual(['E', 'F2']);
  });

  it('keeps D and F1 in customLayerData at night when the environment instant is set', () => {
    const atMs = Date.UTC(2024, 2, 20, 0, 0, 0);
    render(<HfPropagationGlobe layers={NIGHTTIME_LAYERS} environmentAtMs={atMs} />);

    const custom = lastGlobeProps?.customLayerData as { id?: string; kind?: string }[];
    expect(custom.map((d) => d.id).filter(Boolean)).toEqual(['D', 'E', 'F1', 'F2']);
    expect(custom.some((d) => d.kind === 'night-shade')).toBe(true);
    expect(custom.some((d) => d.kind === 'sun')).toBe(false);
    expect(lastGlobeProps?.pathsData).toEqual([]);
  });

  it('adds a dashed terminator path and night-shade layer when the overlay is on', () => {
    const atMs = Date.UTC(2024, 2, 20, 12, 0, 0);
    render(
      <HfPropagationGlobe
        layers={DAYTIME_LAYERS}
        display={{
          exaggerationFactor: 1,
          explodeEnabled: false,
          fresnelEnabled: false,
          terminatorEnabled: true,
        }}
        environmentAtMs={atMs}
      />,
    );

    const custom = lastGlobeProps?.customLayerData as { id?: string; kind?: string }[];
    expect(custom.some((d) => d.kind === 'night-shade')).toBe(true);
    expect(custom.some((d) => d.kind === 'sun')).toBe(true);
    expect(custom.map((d) => d.id).filter(Boolean)).toEqual(['D', 'E', 'F1', 'F2']);
    const paths = lastGlobeProps?.pathsData as { kind: string; points: unknown[] }[];
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.every((p) => p.kind === 'terminator' && p.points.length >= 2)).toBe(true);
  });

  it('renders a transmitter marker, mode-coloured ray paths, skip-zone ring, and legend', () => {
    const rays: RayPathResult[] = [
      {
        mode: 'groundwave',
        points: [
          { lat: 0, lon: 0, altitudeKm: 0 },
          { lat: 0, lon: 2.7, altitudeKm: 0 },
        ],
        takeoffAngleDeg: 3,
        relativeSignalStrength: 1,
      },
      {
        mode: 'skywave',
        points: [
          { lat: 0, lon: 0, altitudeKm: 0 },
          { lat: 0, lon: 10, altitudeKm: 250 },
          { lat: 0, lon: 20, altitudeKm: 0 },
        ],
        takeoffAngleDeg: 20,
        relativeSignalStrength: 0.8,
      },
    ];
    render(<HfPropagationGlobe layers={DAYTIME_LAYERS} rays={rays} />);

    const points = lastGlobeProps?.pointsData as { kind: string; lat: number; lng: number }[];
    expect(points).toEqual([expect.objectContaining({ kind: 'transmitter', lat: 0, lng: 0 })]);

    const paths = lastGlobeProps?.pathsData as { kind: string; mode?: string; color: string }[];
    expect(paths.filter((p) => p.kind === 'ray').map((p) => p.mode)).toEqual([
      'groundwave',
      'skywave',
    ]);
    expect(paths.find((p) => p.kind === 'ray' && p.mode === 'skywave')?.color).toBe(
      MODE_COLORS.skywave,
    );
    expect(paths.some((p) => p.kind === 'skip-zone')).toBe(true);
    expect(lastGlobeProps?.pathDashLength).toBeInstanceOf(Function);
    expect(lastGlobeProps?.pathDashGap).toBeInstanceOf(Function);

    expect(screen.getByLabelText('Propagation mode colours')).toBeInTheDocument();
    expect(screen.getByText('Groundwave')).toBeInTheDocument();
    expect(screen.getByText('NVIS')).toBeInTheDocument();
  });

  it('places the transmitter marker and skip ring at txLat/txLon', () => {
    const rays: RayPathResult[] = [
      {
        mode: 'skywave',
        points: [
          { lat: 51.5, lon: -0.13, altitudeKm: 0 },
          { lat: 52.5, lon: -0.13, altitudeKm: 250 },
          { lat: 53.5, lon: -0.13, altitudeKm: 0 },
        ],
        takeoffAngleDeg: 20,
        relativeSignalStrength: 0.8,
      },
    ];
    render(<HfPropagationGlobe layers={DAYTIME_LAYERS} rays={rays} txLat={51.5} txLon={-0.13} />);

    const points = lastGlobeProps?.pointsData as { kind: string; lat: number; lng: number }[];
    expect(points).toEqual([
      expect.objectContaining({ kind: 'transmitter', lat: 51.5, lng: -0.13 }),
    ]);
    const skipRing = (lastGlobeProps?.pathsData as { kind: string; points: [number, number][] }[])
      .filter((p) => p.kind === 'skip-zone')
      .flatMap((p) => p.points);
    expect(skipRing.length).toBeGreaterThan(0);
    expect(
      skipRing.some(([lat, lon]) => Math.abs(lat - 51.5) < 3 && Math.abs(lon + 0.13) < 3),
    ).toBe(true);
  });

  it('does not add extra customLayerData entries when cutaway is enabled', () => {
    render(
      <HfPropagationGlobe
        layers={DAYTIME_LAYERS}
        cutawayEnabled
        sliceBearingDeg={90}
        txLat={0}
        txLon={0}
      />,
    );
    const custom = lastGlobeProps?.customLayerData as { id?: string; kind?: string }[];
    expect(custom.map((d) => d.id).filter(Boolean)).toEqual(['D', 'E', 'F1', 'F2']);
    expect(custom.every((d) => d.kind !== 'ray-corridor')).toBe(true);
  });
});
