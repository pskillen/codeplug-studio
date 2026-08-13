import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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

describe('shellRadiusUnits', () => {
  it('returns GLOBE_RADIUS_UNITS at the surface (zero altitude)', () => {
    expect(shellRadiusUnits(0)).toBe(GLOBE_RADIUS_UNITS);
  });

  it('scales by one Earth radius of altitude', () => {
    expect(shellRadiusUnits(GLOBE_EARTH_RADIUS_KM)).toBe(GLOBE_RADIUS_UNITS * 2);
  });

  it('returns the expected multiple for the F2 layer mid-altitude', () => {
    const midAltitudeKm = (150 + 400) / 2; // F1/F2 boundary through F2 top, per HARDCODED_SHELLS
    expect(shellRadiusUnits(midAltitudeKm)).toBeCloseTo(
      GLOBE_RADIUS_UNITS * (1 + midAltitudeKm / GLOBE_EARTH_RADIUS_KM),
    );
  });
});

describe('HfPropagationGlobe', () => {
  it('renders react-globe.gl with one customLayerData entry per hard-coded ionospheric shell', () => {
    render(<HfPropagationGlobe />);

    expect(screen.getByTestId('globe-stub')).toBeInTheDocument();
    const shells = lastGlobeProps?.customLayerData as { id: string }[];
    expect(shells.map((s) => s.id)).toEqual(['D', 'E', 'F1', 'F2']);
    expect(lastGlobeProps?.customThreeObject).toBeInstanceOf(Function);
  });
});
