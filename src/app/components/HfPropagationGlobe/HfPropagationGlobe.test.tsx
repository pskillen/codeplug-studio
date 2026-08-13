import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { IonosphericLayerState } from '@core/domain/hfPropagation/types.ts';
import HfPropagationGlobe, { GLOBE_RADIUS_UNITS, shellRadiusUnits } from './HfPropagationGlobe.tsx';
import { GLOBE_EARTH_RADIUS_KM } from '../SatelliteGlobe/globeAltitude.ts';

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
  it('passes only active layers to customLayerData', () => {
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

  it('does not draw a physics-inactive layer even if the operator leaves it visible', () => {
    render(
      <HfPropagationGlobe
        layers={NIGHTTIME_LAYERS}
        visibleLayers={{ D: true, E: true, F1: true, F2: true }}
      />,
    );

    const shells = lastGlobeProps?.customLayerData as { id: string }[];
    expect(shells.map((s) => s.id)).toEqual(['E', 'F2']);
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
    expect(custom.map((d) => d.id).filter(Boolean)).toEqual(['D', 'E', 'F1', 'F2']);
    const paths = lastGlobeProps?.pathsData as { kind: string; points: unknown[] }[];
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.every((p) => p.kind === 'terminator' && p.points.length >= 2)).toBe(true);
  });
});
