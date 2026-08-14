# PropagationTopDownMap

## Purpose

Leaflet plan view for the [HF/RF propagation visualiser](../../../../docs/features/hf-propagation/README.md) — transmitter marker, isotropic groundwave and skip-zone rings, and the ground track of the currently traced ray. Same `react-leaflet` conventions as [`SatelliteTrackMap`](../SatelliteTrackMap/SatelliteTrackMap.md) (`computeMapView`, `ApplyMapView` `setView`/`fitBounds`, OSM tiles). Reuses phase 9 ring geometry (`computePropagationRing` / `skipZoneOuterRadiusM`) and `MODE_COLORS` — no extra physics and no second Worker request.

## Props

| Prop          | Type                            | Notes                                                                                          |
| ------------- | ------------------------------- | ---------------------------------------------------------------------------------------------- |
| `transmitter` | `{ lat: number; lon: number }`  | Map centre and ring origin — the Environment panel’s `txLat`/`txLon` (placeholder 0°, 0°).     |
| `rays`        | `RayPathResult[]`               | Same Worker result the 3D globe already holds. Rings use the full set; the track uses `rays[0]`. |

## Usage

```tsx
import { lazy, Suspense } from 'react';

const PropagationTopDownMap = lazy(
  () => import('../../components/PropagationTopDownMap/PropagationTopDownMap.tsx'),
);

<Suspense fallback={<div>Loading top-down view…</div>}>
  <PropagationTopDownMap transmitter={{ lat: txLat, lon: txLon }} rays={rays} />
</Suspense>;
```

`HfPropagationPage.tsx` renders this when the View `SegmentedControl` is `'top-down'`.

## Behaviour

- **Rings:** groundwave circle at `GROUNDWAVE_MAX_RANGE_KM` (300 km) in `MODE_COLORS.groundwave`. Skip-zone / NVIS outer ring from `skipZoneOuterRadiusM` (nearest skywave/NVIS landing), dashed `#ff6b6b`. Both are isotropic approximations — not a 360° azimuth sweep.
- **Ray track:** `rayGroundTrack` maps `rays[0].points` to `[lat, lon]` (altitude dropped). Colour from `MODE_COLORS[rays[0].mode]`. Later takeoff angles in the fan are not drawn (v1 single-bearing view; the 3D globe still shows the full elevation fan).
- **Camera:** `computeMapView` fits the transmitter plus that track (`padding` 24px, `maxZoom` 8, `singlePointZoom` 5). `ApplyMapView` matches `SatelliteTrackMap` (`setView` vs `L.latLngBounds` + `fitBounds`).
- **Marker:** `L.divIcon` at the transmitter, same `#4d7cff` as the globe TX point.
- **Sizing:** wrapper fills the page viewport (`min-height` 420px); `MapResizeFix` calls `invalidateSize` on container resize.

## Related

- [HF/RF propagation visualiser hub](../../../../docs/features/hf-propagation/README.md)
- [`HfPropagationGlobe`](../HfPropagationGlobe/HfPropagationGlobe.md) — 3D sibling; supplies `MODE_COLORS`
- [`footprint.ts`](../../../core/domain/hfPropagation/footprint.ts) — ring geometry
- [`HfPropagationPage.tsx`](../../routes/reference/HfPropagationPage.tsx) — sole caller; `usePropagationRayTrace` is on the page, not in this map
