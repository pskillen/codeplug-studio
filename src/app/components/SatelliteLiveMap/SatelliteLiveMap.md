# SatelliteLiveMap

## Purpose

Live position + visible-horizon footprint + orbit-trail map for the satellite detail page (`SatelliteDetailPage.tsx`). Continuously re-propagates a moving marker and its footprint circle, and draws two independent orbit-trail ground tracks (1.5 orbits ahead, solid; 1.5 orbits behind, dashed) on an OpenStreetMap tile layer, auto-fitting the view to the current footprint circle. New sibling to [`SatelliteTrackMap`](../SatelliteTrackMap/SatelliteTrackMap.md) rather than a `mode` switch on it — that component is shaped around a single AOS→LOS pass preview (one static track, one static observer marker); this one is continuously live-updating and has no observer or pass-window concept.

## Props

| Prop                  | Type     | Notes                                                                                            |
| --------------------- | -------- | ------------------------------------------------------------------------------------------------ |
| `satelliteName`       | `string` | Shown in the "Acquiring live position…" hint before the first propagation resolves               |
| `tleLine1`            | `string` | Raw TLE line 1 — propagation source of truth                                                     |
| `tleLine2`            | `string` | Raw TLE line 2                                                                                   |
| `meanMotionRevPerDay` | `number` | Orbital mean motion (already decoded on `Satellite`); used to derive the orbit-trail time window |

## Usage

```tsx
import SatelliteLiveMap from '../../components/SatelliteLiveMap/SatelliteLiveMap.tsx';

<SatelliteLiveMap
  satelliteName={satellite.name}
  tleLine1={satellite.tleLine1}
  tleLine2={satellite.tleLine2}
  meanMotionRevPerDay={satellite.meanMotionRevPerDay}
/>;
```

## Behaviour

- **Live position:** `useLiveSatellitePosition` (`src/app/routes/tracking/useLiveSatellitePosition.ts`) re-propagates the subsatellite point every 2 seconds by default; the marker (amber dot, distinct from `SatelliteTrackMap`'s blue observer dot) is hidden and an "Acquiring live position for `<name>`…" hint shown until the first propagation resolves.
- **Footprint circle:** `computeSatelliteFootprint` (`src/core/domain/satelliteTracking/footprint.ts`) is recomputed every time the live position updates, so the visible-horizon circle tracks the marker.
- **Orbit trails:** `computeOrbitTrailSegments` (`./orbitTrail.ts`) derives `periodMinutes = 1440 / meanMotionRevPerDay` and samples 1.5 orbital periods ahead (solid) and 1.5 periods behind (dashed via Leaflet's `dashArray`) from an anchor instant fixed at mount — the trail window doesn't resample on every live-position poll tick, only the marker/footprint move within it.
- **Antimeridian handling:** `splitAtAntimeridian` (`../SatelliteTrackMap/mapHelpers.ts`) is applied **independently** to the future segment, the past segment, and the footprint circle — each is its own non-adjacent sample set, so splitting one combined polyline would not be equivalent.
- **Auto-fit:** the map view fits to the current footprint circle (falling back to just the live position, then a world view) via the same `computeMapView` helper `SatelliteTrackMap` uses — trail segments are drawn but excluded from the fit bounds, since including a full 3-orbit ribbon would zoom out too far to see the marker/footprint clearly.

## Related

- [Satellite tracking feature hub](../../../../docs/features/satellite-tracking/README.md)
- [`SatelliteTrackMap`](../SatelliteTrackMap/SatelliteTrackMap.md) — sibling component for single-pass ground-track preview; shares `mapHelpers.ts`
- [`mapHelpers.ts`](../SatelliteTrackMap/mapHelpers.ts) — shared `splitAtAntimeridian`
- [`orbitTrail.ts`](./orbitTrail.ts) — pure orbit-trail segment computation
- [`footprint.ts`](../../../core/domain/satelliteTracking/footprint.ts) — pure footprint-circle computation
- [`useLiveSatellitePosition.ts`](../../routes/tracking/useLiveSatellitePosition.ts) — live position polling hook
