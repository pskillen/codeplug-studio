# SatelliteTrackMap

## Purpose

2D ground-track preview for a single selected satellite pass (or every default pass under an active satellite filter) on the Tracking Dashboard. Draws the AOS→LOS subsatellite track and the observer's position on an OpenStreetMap tile layer, auto-fitting bounds to whatever is currently shown. Each drawn pass also gets a de-emphasised live-position marker and dotted below-horizon approach track (see Behaviour). New sibling to [`CodeplugMap`](../CodeplugMap/CodeplugMap.md) — that component is tightly coupled to Channel/Zone domain, so this one reuses only the shared `computeMapView` helper and `L.divIcon` marker convention, not `CodeplugMap` itself.

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
- **Live position + dotted approach ([#1094](https://github.com/pskillen/codeplug-studio/issues/1094)):** for every drawn pass, `useLiveSatellitePositions` (`src/app/components/SatelliteGlobe/useLiveSatellitePositions.ts` — the multi-satellite variant, shared with `SatelliteGlobe` rather than the single-sat `useLiveSatellitePosition`, since calling a hook once per array entry would violate the rules of hooks) propagates a current subsatellite point, rendered as a small white-bordered marker via `liveSatelliteDivIcon` (`mapHelpers.ts`). `computeApproachTrack` (`SatelliteTrackMap.tsx`) samples a dotted ground track from that live position to the pass's `aosAt` — joined to the **AOS→LOS** segment itself, not to any `drawBehindMin`/`drawAheadMin`-extended solid tail — so the dotted part stays the below-horizon approach. It returns no segments (marker-only) once `nowAt` reaches `aosAt` (already on/past the interesting segment) or when the gap exceeds a ~3-hour cap (`MAX_APPROACH_SPAN_MS`) — default passes can be up to the dashboard's 168h look-ahead window away, and sampling that whole gap would stop reading as "the approach to this pass". Both the marker and dotted stroke use `colorForNoradId(noradId, 0.75)` — the same per-satellite hue as the solid track, reduced alpha (down from an initial `0.45`, bumped after review — too subtle to read at a glance) — so they read as de-emphasised supporting context without disappearing against basemap tiles. Marker icons are memoized per NORAD id (not per poll tick) to avoid `Marker` icon-identity churn, matching `SatelliteLiveMap`'s convention. Live position and the approach track are excluded from `MapViewController`'s auto-fit bounds, so a poll tick never fights manual camera control.
- **World-copy placement for the live marker:** `duplicateSegmentsForWorldCopies` draws the pass track (and its dotted approach) at all three `lng` repeats (`-360`/`0`/`+360`), but a `Marker` is a single point — drawn at its raw, un-offset longitude it can end up visually detached from the track/observer repeat the operator is looking at whenever the live position and the pass's AOS sample fall on opposite sides of an antimeridian crossing the raw sample stream passed through unshifted. `chooseWorldCopyOffset` (`mapHelpers.ts`) picks whichever of the three offsets puts the marker closest to the pass track's own central-copy first sample, so the dot always "meets up with" the track it's approaching — snapping east or west a whole world-copy when needed, or staying at the raw position when it's already the closest.

## Related

- [Satellite tracking feature hub](../../../../docs/features/satellite-tracking/README.md)
- [`PassGrid`](../../routes/tracking/PassGrid.tsx) — row click sets `selectedPass`
- [`groundTrack.ts`](../../../core/domain/satelliteTracking/groundTrack.ts) — pure sampling function
