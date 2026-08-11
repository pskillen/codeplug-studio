# SatelliteTrackMap

## Purpose

2D ground-track preview for a single selected satellite pass on the Tracking Dashboard. Draws the AOS→LOS subsatellite track and the observer's position on an OpenStreetMap tile layer, auto-fitting bounds to whatever is currently shown. New sibling to [`CodeplugMap`](../CodeplugMap/CodeplugMap.md) — that component is tightly coupled to Channel/Zone domain, so this one reuses only the shared `computeMapView` helper and `L.divIcon` marker convention, not `CodeplugMap` itself.

## Props

| Prop            | Type                                   | Notes                                                                                                          |
| --------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `observer`      | `{ lat: number; lon: number } \| null` | Observer location marker; included in auto-fit bounds when set                                                 |
| `selectedPass`  | `SelectedPass \| null`                 | When set, draws only this pass (overrides `defaultPasses`). Includes `noradId` for per-satellite track colour. |
| `defaultPasses` | `SelectedPass[]` (optional)            | Next pass per satellite when a pass-grid satellite filter is active and no row is selected                     |
| `drawBehindMin` | `number` (optional, default `0`)       | Minutes to extend the drawn track **before** `aosAt`, relative to the pass window                              |
| `drawAheadMin`  | `number` (optional, default `0`)       | Minutes to extend the drawn track **past** `losAt`, relative to the pass window                                |

## Usage

```tsx
import SatelliteTrackMap from '../../components/SatelliteTrackMap/SatelliteTrackMap.tsx';

<SatelliteTrackMap observer={settings?.location ?? null} selectedPass={selectedPass} />;
```

## Behaviour

- Ground track is sampled via `sampleGroundTrack` (`src/core/domain/satelliteTracking/groundTrack.ts`) at 30-second steps between the pass's `aosAt` and `losAt`, extended by `drawBehindMin`/`drawAheadMin` (see `computeTrackBounds` in `SatelliteTrackMap.tsx`). Polyline colour comes from `colorForNoradId(pass.noradId)` so multi-satellite default tracks stay distinguishable and match the pass grid / 3D globe.
- **Draw-ahead/behind semantics:** "ahead" and "behind" are relative to the **pass window** (AOS/LOS), not to current wall-clock time — this stays well-defined when previewing a past or future pass. `drawBehindMin` pushes the sampled start earlier than `aosAt`; `drawAheadMin` pushes the sampled end later than `losAt`. Both default to `0`, preserving strict AOS-to-LOS drawing until the operator adjusts the controls (labelled "Extend before AOS (min)" / "Extend after LOS (min)" below the ground-track map on the Tracking Dashboard).
- **Antimeridian handling:** the track is split into separate `Polyline` segments wherever consecutive samples' longitude delta exceeds 180° — LEO ground tracks routinely cross ±180°, and a single polyline would otherwise draw a spurious line across the whole map. This still applies to the full extended range, not just the strict AOS→LOS segment. `splitAtAntimeridian` and the observer `L.DivIcon` builder (`observerDivIcon`, a module-level singleton — not rebuilt per render) live in [`mapHelpers.ts`](./mapHelpers.ts), shared with the satellite detail page's live map.
- **World-copy duplication:** after antimeridian splitting, each segment is also drawn at `lng ± 360°` via `duplicateSegmentsForWorldCopies` so pass lines remain visible when Leaflet's tile layer wraps at low zoom (a separate problem from the antimeridian stretch fix).
- No 3D/2D toggle — there is no 3D globe in this plan's scope ([#866](https://github.com/pskillen/codeplug-studio/issues/866) deferred); a visible-but-dead control would be worse than no control.
- **Camera auto-fit:** `MapViewController` shows one world repeat by default (auto-drawn default passes and empty state). Selecting a specific pass row fits bounds to that pass's track. After the operator pans or zooms, auto-fit is suppressed until they select a different pass — draw-ahead/behind tweaks and live track refreshes no longer fight manual camera control.
- With no `selectedPass`, draws every entry in `defaultPasses` when the dashboard has an active satellite filter (empty filter = no auto-draw — ground-track sampling is expensive). The hint overlay appears when both `selectedPass` and `defaultPasses` are empty.

## Related

- [Satellite tracking feature hub](../../../../docs/features/satellite-tracking/README.md)
- [`PassGrid`](../../routes/tracking/PassGrid.tsx) — row click sets `selectedPass`
- [`groundTrack.ts`](../../../core/domain/satelliteTracking/groundTrack.ts) — pure sampling function
