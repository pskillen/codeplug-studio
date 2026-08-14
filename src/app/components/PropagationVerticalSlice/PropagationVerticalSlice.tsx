import { useMemo } from 'react';
import { colorForLayer } from '@core/domain/hfPropagation/layerColor.ts';
import type { IonosphericLayerState, RayPathResult } from '@core/domain/hfPropagation/types.ts';
import { MODE_COLORS } from '../HfPropagationGlobe/buildGlobeData.ts';
import classes from './PropagationVerticalSlice.module.css';
import {
  CHART_HEIGHT,
  CHART_WIDTH,
  cumulativeDistancesM,
  xForDistanceM,
  yForAltitudeKm,
} from './sliceChartGeometry.ts';

export interface PropagationVerticalSliceProps {
  layers: IonosphericLayerState[];
  ray: RayPathResult | null;
  maxRangeM: number;
}

/**
 * Height-vs-distance SVG of D/E/F1/F2 bands and one traced ray along the slice plane.
 * Layer fills use `colorForLayer`; the ray stroke uses `MODE_COLORS`.
 */
export default function PropagationVerticalSlice({
  layers,
  ray,
  maxRangeM,
}: PropagationVerticalSliceProps) {
  const layerBands = layers.filter((l) => l.active);

  const rayPathSvg = useMemo(() => {
    if (!ray || ray.points.length === 0) return null;
    const distances = cumulativeDistancesM(ray.points);
    const pathD = ray.points
      .map((p, i) => {
        const x = xForDistanceM(distances[i] ?? 0, maxRangeM);
        const y = yForAltitudeKm(p.altitudeKm);
        return `${i === 0 ? 'M' : 'L'}${x},${y}`;
      })
      .join(' ');
    return { d: pathD, color: MODE_COLORS[ray.mode] };
  }, [ray, maxRangeM]);

  return (
    <div className={classes.wrapper}>
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className={classes.chart}
        role="img"
        aria-label="Vertical slice of ionospheric layers and ray path"
        data-testid="vertical-slice-chart"
      >
        <line
          x1={0}
          y1={CHART_HEIGHT}
          x2={CHART_WIDTH}
          y2={CHART_HEIGHT}
          stroke="#333"
          strokeWidth={2}
        />
        {layerBands.map((layer) => (
          <rect
            key={layer.id}
            data-testid={`layer-band-${layer.id}`}
            x={0}
            y={yForAltitudeKm(layer.altitudeMaxKm)}
            width={CHART_WIDTH}
            height={yForAltitudeKm(layer.altitudeMinKm) - yForAltitudeKm(layer.altitudeMaxKm)}
            fill={colorForLayer(layer.id)}
            opacity={0.12}
          />
        ))}
        {rayPathSvg ? (
          <path
            data-testid="slice-ray-path"
            d={rayPathSvg.d}
            stroke={rayPathSvg.color}
            strokeWidth={2}
            fill="none"
          />
        ) : null}
      </svg>
    </div>
  );
}
