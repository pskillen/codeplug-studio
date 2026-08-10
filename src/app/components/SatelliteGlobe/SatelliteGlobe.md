# SatelliteGlobe

## Purpose

3D orbital globe for the Tracking Dashboard (`TrackingDashboardPage.tsx`) — an observer marker, every enabled satellite as a live-moving dot, a ~90-minute orbit trail per satellite, and a visible-horizon footprint circle per satellite with a resolved live position. Renders with [`react-globe.gl`](https://github.com/vasturiano/react-globe.gl) (`three`/`three-globe` underneath). Sibling to [`SatelliteLiveMap`](../SatelliteLiveMap/SatelliteLiveMap.md) (2D Leaflet, single-satellite detail page) rather than a shared component — a 3D globe wraps longitude natively, so none of `SatelliteTrackMap/mapHelpers.ts`'s antimeridian-splitting applies, and this component tracks many satellites at once instead of one.

## Props

| Prop                   | Type                            | Notes                                                                                        |
| ---------------------- | ------------------------------- | -------------------------------------------------------------------------------------------- |
| `observer`             | `LatLon \| null`                | Observer marker location, from `TrackingSettings`. `null` — no observer point.               |
| `satellites`           | `GlobeSatellite[]`              | Enabled satellites: `{ id, name, tleLine1, tleLine2, meanMotionRevPerDay }`.                 |
| `selectedSatelliteIds` | `Set<string>`                   | Pass-grid satellite filter. Empty set = no filter, every satellite shown at full brightness. |
| `onSelectSatellite`    | `(satelliteId: string) => void` | Called when a satellite dot is clicked — wire to the same filter state `PassGrid` reads.     |

## Usage

```tsx
import SatelliteGlobe from '../../components/SatelliteGlobe/SatelliteGlobe.tsx';

<SatelliteGlobe
  observer={settings?.location ?? null}
  satellites={enabledSatellites}
  selectedSatelliteIds={selectedSatelliteIds}
  onSelectSatellite={handleSelectSatelliteFromGlobe}
/>;
```

## Behaviour

- **Live positions:** `useLiveSatellitePositions.ts` — a multi-satellite sibling to `useLiveSatellitePosition` (`src/app/routes/tracking/useLiveSatellitePosition.ts`, single-satellite, built for the detail page). Calling that hook once per array entry would violate the rules of hooks, so this variant re-propagates every enabled satellite on one shared 2-second poll interval instead, keyed by satellite `id`.
- **Orbit trails:** `orbitTrail.ts#computeGlobeOrbitTrail` — a ~90-minute window (one full orbital period, half ahead of an anchor instant fixed at mount, half behind), derived per-satellite via `periodMinutes = 1440 / meanMotionRevPerDay` (same formula as `SatelliteLiveMap/orbitTrail.ts`, not reused directly — that function hardcodes a 1.5-orbit window and antimeridian-split segments this component doesn't need).
- **Footprint circle:** `computeSatelliteFootprint` (`src/core/domain/satelliteTracking/footprint.ts`) reused directly, recomputed whenever a satellite's live position updates. Only drawn once a satellite has a resolved live position.
- **Point/path data:** `buildGlobeData.ts` computes `react-globe.gl`'s `pointsData`/`pathsData` shapes — kept separate from the component so it's unit-testable without a WebGL context (jsdom has none). Split into two pieces the component memoizes independently: `computeGlobeTrailPaths(satellites, anchorAt)` (orbit trails only) and `computeGlobePointsAndFootprints(observer, satellites, livePositions, selectedSatelliteIds)` (observer/satellite dots + footprint circles). **Not** a single combined computation sharing one `useMemo` dependency array — live-browser testing with a 97-satellite CelesTrak amateur fetch showed that redoing all satellites' SGP4-heavy trail sampling (~180 points × 2 directions each) on every 2-second live-position poll tick stalls the main thread. Trails only recompute when the enabled-satellite set itself changes; footprints (cheap, ~72 points, one `computeSatelliteFootprint` call) recompute every tick as before.
- **Selection dimming:** satellites not in `selectedSatelliteIds` (when non-empty) render dimmed rather than hidden, so the full constellation stays visible while one satellite is highlighted.
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
