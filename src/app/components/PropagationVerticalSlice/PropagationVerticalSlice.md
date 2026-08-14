# PropagationVerticalSlice

## Purpose

Hand-rolled SVG height-vs-distance chart for the [HF/RF propagation visualiser](../../../../docs/features/hf-propagation/README.md). Draws active D/E/F1/F2 layer bands and one traced ray along the slice plane from [`SlicePlanePicker`](../../routes/reference/SlicePlanePicker.tsx). Reuses `colorForLayer` (shell colours) and `MODE_COLORS` (ray stroke) — no third colour mapping.

## Props

| Prop        | Type                      | Notes                                                                                          |
| ----------- | ------------------------- | ---------------------------------------------------------------------------------------------- |
| `layers`    | `IonosphericLayerState[]` | Same TX-local layers as the globe. Only `active` layers get a band.                            |
| `ray`       | `RayPathResult \| null`   | Dominant ray from the primary Worker result when the slice bearing matches heading; otherwise the off-heading trace. |
| `maxRangeM` | `number`                  | Horizontal scale — the picker’s `distanceM` (bearing-mode default 4,000 km).                   |

## Usage

```tsx
import { lazy, Suspense } from 'react';

const PropagationVerticalSlice = lazy(
  () => import('../../components/PropagationVerticalSlice/PropagationVerticalSlice.tsx'),
);

<Suspense fallback={<div>Loading vertical slice…</div>}>
  <PropagationVerticalSlice layers={layers} ray={verticalSliceRay} maxRangeM={slicePlane.distanceM} />
</Suspense>;
```

`HfPropagationPage.tsx` renders this when the View `SegmentedControl` is `'vertical-slice'`.

## Behaviour

- **Axes:** x is ground range (0…`maxRangeM`), y is altitude (0…500 km, F2 headroom). Pixel helpers and `cumulativeDistancesM` live in `sliceChartGeometry.ts`.
- **Bands:** a full-width `rect` per active layer from `altitudeMinKm`…`altitudeMaxKm`, fill `colorForLayer(id)` at 0.12 opacity.
- **Ray:** SVG path through successive points; segment lengths from `haversineDistanceM`. Stroke `MODE_COLORS[ray.mode]`.
- **Worker:** the page calls `usePropagationRayTrace` a second time only when View is vertical-slice **and** `|sliceBearing − antennaAzimuth| > 0.5°`. Matching bearings reuse the globe’s rays — no second request.

## Related

- [HF/RF propagation visualiser hub](../../../../docs/features/hf-propagation/README.md)
- [`HfPropagationGlobe`](../HfPropagationGlobe/HfPropagationGlobe.md) — 3D sibling; `MODE_COLORS`
- [`layerColor.ts`](../../../core/domain/hfPropagation/layerColor.ts) — `colorForLayer`
- [`HfPropagationPage.tsx`](../../routes/reference/HfPropagationPage.tsx) — sole caller
