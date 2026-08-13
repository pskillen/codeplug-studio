import { useEffect, useMemo, useRef, useState } from 'react';
import Globe from 'react-globe.gl';
import type { IonosphericLayerState } from '@core/domain/hfPropagation/types.ts';
import {
  buildShellMesh,
  type ShellDisplayOptions,
} from './buildGlobeData.ts';
import classes from './HfPropagationGlobe.module.css';

export {
  buildShellMesh,
  displayShellRadiusUnits,
  GLOBE_RADIUS_UNITS,
  SHELL_BASELINE_OPACITY,
  shellRadiusUnits,
} from './buildGlobeData.ts';
export type { ShellDisplayOptions } from './buildGlobeData.ts';

const GLOBE_IMAGE_URL = '//unpkg.com/three-globe/example/img/earth-blue-marble.jpg';
const BACKGROUND_COLOR = '#000011';

export interface HfPropagationGlobeProps {
  layers: IonosphericLayerState[];
  display?: ShellDisplayOptions;
}

const DEFAULT_DISPLAY: ShellDisplayOptions = {
  exaggerationFactor: 1,
  explodeEnabled: false,
};

/**
 * 3D propagation globe — renders active ionospheric shells (D/E/F1/F2) as concentric
 * translucent spheres via `react-globe.gl`'s `customThreeObject` extension point. No ray
 * paths or transmitter marker yet (#1170).
 */
export default function HfPropagationGlobe({
  layers,
  display = DEFAULT_DISPLAY,
}: HfPropagationGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const activeLayers = useMemo(() => layers.filter((layer) => layer.active), [layers]);
  const { exaggerationFactor, explodeEnabled } = display;

  const shellObjectAccessor = useMemo(
    () => (d: object) => {
      const index = activeLayers.indexOf(d as IonosphericLayerState);
      return buildShellMesh(d, index, { exaggerationFactor, explodeEnabled });
    },
    [activeLayers, exaggerationFactor, explodeEnabled],
  );

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    resizeObserver.observe(node);
    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div className={classes.wrapper} ref={containerRef}>
      <Globe
        globeImageUrl={GLOBE_IMAGE_URL}
        backgroundColor={BACKGROUND_COLOR}
        showAtmosphere
        width={size.width || undefined}
        height={size.height || undefined}
        customLayerData={activeLayers}
        customThreeObject={shellObjectAccessor}
      />
    </div>
  );
}
