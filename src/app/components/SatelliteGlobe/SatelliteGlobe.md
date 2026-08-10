# SatelliteGlobe

## Purpose

3D orbital globe for the Tracking Dashboard (`TrackingDashboardPage.tsx`) — an observer marker, every enabled satellite as a live-moving dot, a ~90-minute orbit trail per satellite, and a visible-horizon footprint circle per satellite with a resolved live position. Renders with [`react-globe.gl`](https://github.com/vasturiano/react-globe.gl) (`three`/`three-globe` underneath). **Code-split:** `TrackingDashboardPage` lazy-loads this component behind `React.Suspense` so `three`/`react-globe.gl` are not in the main bundle for visitors who never open `/tracking`. Sibling to [`SatelliteLiveMap`](../SatelliteLiveMap/SatelliteLiveMap.md) (2D Leaflet, single-satellite detail page) rather than a shared component — a 3D globe wraps longitude natively, so none of `SatelliteTrackMap/mapHelpers.ts`'s antimeridian-splitting applies, and this component tracks many satellites at once instead of one.

## Props

| Prop                      | Type                            | Notes                                                                                    |
| ------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------- |
| `observer`                | `LatLon \| null`                | Observer marker location, from `TrackingSettings`. `null` — no observer point.           |
| `satellites`              | `GlobeSatellite[]`              | Enabled satellites: `{ id, name, tleLine1, tleLine2, meanMotionRevPerDay }`.             |
| `interestedSatelliteIds`  | `Set<string>`                   | Dashboard interest filter — only these satellites render (dots, trails, footprints).     |
| `highlightedSatelliteIds` | `Set<string>`                   | Pass-grid multi-select highlight. Empty set = no dot emphasis.                           |
| `onSelectSatellite`       | `(satelliteId: string) => void` | Called when a satellite dot is clicked — wire to the same filter state `PassGrid` reads. |

## Usage

```tsx
import { lazy, Suspense } from 'react';

const SatelliteGlobe = lazy(() => import('../../components/SatelliteGlobe/SatelliteGlobe.tsx'));

<Suspense fallback={<div>Loading 3D globe…</div>}>
  <SatelliteGlobe
    observer={settings?.location ?? null}
    satellites={enabledSatellites}
    interestedSatelliteIds={interestedSatelliteIds}
    highlightedSatelliteIds={selectedSatelliteIds}
    onSelectSatellite={handleSelectSatelliteFromGlobe}
  />
</Suspense>;
```

## Behaviour

- **Live positions:** `useLiveSatellitePositions.ts` — a multi-satellite sibling to `useLiveSatellitePosition` (`src/app/routes/tracking/useLiveSatellitePosition.ts`, single-satellite, built for the detail page). Calling that hook once per array entry would violate the rules of hooks, so this variant re-propagates every **visible** enabled satellite on one shared **10-second** poll interval instead, keyed by satellite `id`. Position map entries are reused when subsatellite geometry is unchanged between ticks so downstream memoization stays stable. Satellite dots render at WGS84 altitude (`altitudeKm` → globe-radius units via `globeAltitude.ts`) and use a per-satellite colour from `colorForNoradId` (`src/core/domain/satelliteTracking/satelliteColor.ts`).
- **Orbit trails:** `orbitTrail.ts#computeGlobeOrbitTrail` — a ~90-minute window (one full orbital period, half ahead of an anchor instant fixed at mount, half behind), derived per-satellite via `periodMinutes = 1440 / meanMotionRevPerDay` (same formula as `SatelliteLiveMap/orbitTrail.ts`, not reused directly — that function hardcodes a 1.5-orbit window and antimeridian-split segments this component doesn't need). Trail paths use sampled WGS84 altitude at each step (`sampleOrbitTrack`), converted to globe-radius units via `globeAltitude.ts`.
- **Footprint circle:** `computeSatelliteFootprint` (`src/core/domain/satelliteTracking/footprint.ts`) reused directly, recomputed whenever a satellite's live position updates. Only drawn once a satellite has a resolved live position. All used layer transition durations (`pointsTransitionDuration`, `pathTransitionDuration`, `pathDashAnimateTime`, plus unused `arcs`/`labels` for belt-and-braces) are set to `0` so poll updates snap instead of morphing.
- **Point/path data:** `buildGlobeData.ts` computes `react-globe.gl`'s `pointsData`/`pathsData` shapes — kept separate from the component so it's unit-testable without a WebGL context (jsdom has none). Split into two pieces the component memoizes independently: `computeGlobeTrailPaths(satellites, anchorAt)` (orbit trails only) and `computeGlobePointsAndFootprints(observer, satellites, livePositions, highlightedSatelliteIds)` (observer/satellite dots + footprint circles). `useLiveSatellitePositions` reuses prior `Map` and position object references when subsatellite geometry is unchanged between polls so memoized geometry does not restart Kapsule animations unnecessarily. Trails only recompute when the visible-satellite set changes; footprints recompute when live positions update.
- **Interest filter:** `filterGlobeSatellitesByInterest` hides satellites outside the dashboard's `interestedSatelliteIds` set (frequency toggle + multi-select) — dots, trails, and footprints omitted rather than dimmed.
- **Click-to-filter:** clicking a satellite dot calls `onSelectSatellite`; `TrackingDashboardPage` toggles the shared filter set (select-only-this, or clear if it's already the sole selection) that both the globe and `PassGrid` read.
- **Sizing:** `react-globe.gl` defaults its canvas to the _window's_ size, not its container's. A `ResizeObserver` on the wrapper measures the actual panel size and passes it as explicit `width`/`height`.

## Testing

`react-globe.gl` needs a WebGL context jsdom doesn't provide, so `SatelliteGlobe.test.tsx` mocks it to a stub component and asserts the `pointsData`/`pathsData`/`onPointClick` props it receives — state and prop wiring, not rendered 3D output.

## Related

- [Satellite tracking feature hub](../../../../docs/features/satellite-tracking/README.md)
- [`SatelliteLiveMap`](../SatelliteLiveMap/SatelliteLiveMap.md) — 2D sibling for the single-satellite detail page
- [`footprint.ts`](../../../core/domain/satelliteTracking/footprint.ts) — pure footprint-circle computation, reused directly
- [`groundTrack.ts`](../../../core/domain/satelliteTracking/groundTrack.ts) — pure ground-track sampling, reused via `orbitTrail.ts`
- [`TrackingDashboardPage.tsx`](../../routes/tracking/TrackingDashboardPage.tsx) — hosts the globe and owns the shared satellite-filter state
- [`PassGrid.tsx`](../../routes/tracking/PassGrid.tsx) — reads the same filter state, filtered by a globe click
