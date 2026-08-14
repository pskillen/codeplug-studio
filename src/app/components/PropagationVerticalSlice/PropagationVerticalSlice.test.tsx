import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { colorForLayer } from '@core/domain/hfPropagation/layerColor.ts';
import type { IonosphericLayerState, RayPathResult } from '@core/domain/hfPropagation/types.ts';
import { MODE_COLORS } from '../HfPropagationGlobe/buildGlobeData.ts';
import PropagationVerticalSlice from './PropagationVerticalSlice.tsx';

const layers: IonosphericLayerState[] = [
  { id: 'D', active: true, altitudeMinKm: 60, altitudeMaxKm: 90, peakElectronDensity: 1 },
  { id: 'E', active: true, altitudeMinKm: 90, altitudeMaxKm: 150, peakElectronDensity: 1 },
  { id: 'F1', active: false, altitudeMinKm: 150, altitudeMaxKm: 210, peakElectronDensity: 0 },
  { id: 'F2', active: true, altitudeMinKm: 210, altitudeMaxKm: 400, peakElectronDensity: 1 },
];

const skywave: RayPathResult = {
  mode: 'skywave',
  takeoffAngleDeg: 20,
  relativeSignalStrength: 0.8,
  points: [
    { lat: 0, lon: 0, altitudeKm: 0 },
    { lat: 0, lon: 5, altitudeKm: 250 },
    { lat: 0, lon: 10, altitudeKm: 0 },
  ],
};

describe('PropagationVerticalSlice', () => {
  it('fills active layer bands with colorForLayer and skips inactive layers', () => {
    render(<PropagationVerticalSlice layers={layers} ray={null} maxRangeM={4_000_000} />);

    expect(screen.getByTestId('layer-band-D')).toHaveAttribute('fill', colorForLayer('D'));
    expect(screen.getByTestId('layer-band-E')).toHaveAttribute('fill', colorForLayer('E'));
    expect(screen.getByTestId('layer-band-F2')).toHaveAttribute('fill', colorForLayer('F2'));
    expect(screen.queryByTestId('layer-band-F1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('slice-ray-path')).not.toBeInTheDocument();
  });

  it('strokes the ray with MODE_COLORS for its propagation mode', () => {
    render(<PropagationVerticalSlice layers={layers} ray={skywave} maxRangeM={4_000_000} />);

    const path = screen.getByTestId('slice-ray-path');
    expect(path).toHaveAttribute('stroke', MODE_COLORS.skywave);
    expect(path.getAttribute('d')?.startsWith('M')).toBe(true);
  });
});
