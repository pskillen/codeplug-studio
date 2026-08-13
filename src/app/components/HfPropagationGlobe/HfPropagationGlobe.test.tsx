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
  });

  it('passes all four layers when every layer is active', () => {
    render(<HfPropagationGlobe layers={DAYTIME_LAYERS} />);

    const shells = lastGlobeProps?.customLayerData as { id: string }[];
    expect(shells.map((s) => s.id)).toEqual(['D', 'E', 'F1', 'F2']);
  });
});
