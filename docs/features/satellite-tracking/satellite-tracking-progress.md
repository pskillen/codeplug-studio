# Satellite tracking — progress

**Tracking:** [codeplug-studio#860](https://github.com/pskillen/codeplug-studio/issues/860)
**Plan:** `/Users/patricks/.claude/plans/epic-satellite-keps-support-atomic-charm.md`
**Branch:** `848/pskillen/satellite-keps-and-tracking-mvp`

---

## Overall status

**Status:** MVP complete and merged (PR [#975](https://github.com/pskillen/codeplug-studio/pull/975)) — satellite keps library, observer location (geolocation + Maidenhead), SGP4 pass prediction, Tracking Dashboard, and 2D ground-track map, all live-verified end-to-end in a real browser against real CelesTrak data. Slice 5b (Nominatim address search + minimap pin) was deferred out of that PR and completed separately below on `862/pskillen/nominatim-address-search`.

**Branch:** `848/pskillen/satellite-keps-and-tracking-mvp` (merged); Slice 5b on `862/pskillen/nominatim-address-search`

---

## Slice 5a: Observer location settings (#862)

**Status:** Complete (pending merge)

**Delivered**

- `src/core/models/trackingSettings.ts` — `TrackingSettings` singleton model; deliberately a **top-level field on `ProjectAggregate`/`StudioProjectDocument`** (sibling to `radioBuilds`/`egressPaths`), not nested in `Library` — it's a tracking-dashboard preference, not vendor-neutral RF content.
- Persistence: `getTrackingSettings`/`putTrackingSettings`/`listTrackingSettings` in both backends, singleton delete-siblings behavior mirroring `putAprsConfiguration`. `'trackingSettings'` excluded from `LibraryEntityKind` (no spurious case in `registry.ts`'s exhaustive switches). `STUDIO_SCHEMA_VERSION` 23 → 24.
- Native-yaml round-trip: `trackingSettings` parsed/serialised at the document top level (not under `library:`).
- `src/app/state/useTrackingSettings.ts` + `src/app/routes/tracking/ObserverLocationSettings.tsx` — Geolocation button + Maidenhead locator input, auto-saving (no explicit Save button needed for this small a form). Nominatim address search + minimap pin deferred to 5b.
- Not yet routed — `TrackingDashboardPage` (slice 7) will mount this component; verified via unit tests, not yet in a live browser (no route exists until slice 7).

**Bug caught during this slice:** `reassignSeedProjectId`/`normaliseSeedForProject` in `src/core/services/projectSeedMapping.ts` never reassigned `satellites` (silently dropped on project duplicate/import-as-new, since `ProjectSeed` fields are optional so TS didn't flag it) — a gap from slice 3, fixed here alongside wiring `trackingSettings` into the same two functions.

**Verify**

- `npx vitest run` — 2507 tests passing (2 new: singleton replace behavior in both persistence backends).
- `npx tsc --noEmit -p tsconfig.app.json` — 0 errors. Lint/format clean.

---

## Slice 5b: Nominatim address search + minimap pin (#862 stretch)

**Status:** Complete (branch `862/pskillen/nominatim-address-search`)

**Delivered**

- `functions/api/nominatim/search.ts` + `functions/lib/nominatimUpstream.ts` — same-origin CORS bridge for OpenStreetMap Nominatim address search, mirroring the CelesTrak/RepeaterBook proxy shape. Sets an identifying `User-Agent` per Nominatim's usage policy (RepeaterBook is the only other proxy in this repo that needs one); no server-side rate limiting, matching every other proxy — Nominatim's 1 req/s policy is enforced client-side via debounce.
- `vite.config.ts` — matching dev-proxy entry; **live-browser testing caught a real bug** here: the dev proxy forwarded the client's query params as-is without pinning `format=jsonv2`, so Nominatim served its interactive HTML search UI (redirecting to `/ui/search.html`) instead of JSON, which then failed CORS. Fixed to mirror `buildNominatimSearchUpstreamUrl`'s behaviour.
- `src/integrations/geocoding/{nominatimConstants,nominatimClient}.ts` — debounced-by-caller search client; only the search term and a result-count cap are ever sent (no operator/project data).
- `ObserverLocationSettings.tsx` — added a Nominatim search `Combobox` (reused from `v2/`) and `ObserverLocationMap.tsx`, a new sibling to `SatelliteTrackMap` (interactive minimap: click to place a pin, drag to adjust), both saving through the same `save()` helper already used by the geolocation/Maidenhead inputs.
- **Second real bug caught by live-browser drag testing:** `icon={pinDivIcon()}` called inline in JSX built a brand-new `L.DivIcon` on every render; react-leaflet's `Marker` diffs `icon` by reference and calls `marker.setIcon()` whenever it changes, so this fired on every re-render — including mid-drag, corrupting Leaflet's internal drag state and crashing the map. Fixed by hoisting the icon to a module-level singleton. (`SatelliteTrackMap`'s `observerDivIcon()` has the same inline-call pattern but is not draggable, so it doesn't hit this failure mode — flagged as a follow-up, not fixed here.)
- Backfilled `docs/reference/remote-directories/{nominatim,celestrak,amsat}/README.md` and `attributions.ts` rows — CelesTrak/AMSAT shipped under #851 without either, unlike every other remote source in this repo.

**Verify**

- Live-tested end-to-end in a real browser against the real Nominatim API: searched "Glasgow", selected a result, confirmed `TrackingSettings.location`/`maidenheadLocator` updated and persisted across reload, and the minimap recentred/zoomed to the pin. Click-to-place verified via a dispatched click (both a raw DOM click and the tool's coordinate-based click). Drag-to-adjust verified by direct DOM event simulation once the icon-reference bug above was found and fixed; the automation harness's synthetic mouse-drag sequence itself could not be fully exercised end-to-end (confirmed environment-specific — panning the base map via the same synthetic sequence hits an identical crash in Leaflet's own code, unrelated to this component).
- `npm run format:check && npm run lint && npm run test && npm run build` — all green.

---

## Slice 6: SGP4 pass-prediction Web Worker (#863)

**Status:** Complete (pending merge)

**Delivered**

- Added `satellite.js@7.1.0` dependency (zero-dep, safe in `core` — same category as existing `fflate`/`js-yaml`).
- `src/core/domain/satelliteTracking/{types,passPrediction}.ts` — pure `computePassesForSatellite(tleLine1, tleLine2, observer, window)`; sweeps at a configurable step (default 1 min), tracks elevation-crossing AOS/max-elevation/LOS. Deterministic (`fromAt`/`toAt` injected, never `Date.now()`), no DOM/Worker globals.
- `src/integrations/satelliteTracking/{protocol,passPredictionWorker,passPredictionClient}.ts` — **first Web Worker in this repo**. Client correlates concurrent requests by id, handles worker errors, lazily creates/terminates.

**Verify**

- `computePassesForSatellite` tested directly (no Worker) against a genuine geometric invariant: an observer placed at the real ISS TLE's own subsatellite point (computed independently via `eciToGeodetic`) sees >75° elevation at that instant — this is real known-answer verification (the "answer" comes from orbital geometry, not from copying the function's own output), not a tautology.
- `PassPredictionClient` tested with a mocked `Worker` global (6 tests: resolve/reject/concurrent-correlation/reuse/error-fanout/terminate) — vitest doesn't need a real worker thread to verify the request/response correlation logic, which is where the actual business logic lives.
- **Still to verify:** a production `vite build` emitting a genuine separate worker chunk with the `@core` alias resolving inside it — current build tree-shakes `passPredictionClient.ts` entirely since nothing imports it yet (expected; nothing wires it into the UI until slice 7). Re-verify once slice 7 lands.
- `npx vitest run` — 2516 tests passing. `npx tsc --noEmit -p tsconfig.app.json` — 0 errors. Lint/format clean.

---

## Slice 7: Tracking Dashboard shell + pass grid (#865)

**Status:** Complete (pending merge)

**Delivered**

- `/tracking` primary-nav route (requires active project, matching `/builds`), `TrackingDashboardPage.tsx` (observer settings + map placeholder + pass grid), `PassGrid.tsx` (DataTable v2: satellite/AOS/LOS/duration/max-elevation, min-elevation filter, sortable, default AOS-ascending), `useTrackingPasses.ts` (debounced hook wiring `useLibrary()` + `useTrackingSettings()` into `passPredictionClient`, one worker request per enabled satellite via `Promise.all`).
- Freq/mode/status-from-SatNOGS columns omitted per plan (#854/#864 out of scope) — actionable empty states instead (deep-link to Satellite Keps / prompt to set observer location).

**Two real build/dev-tooling bugs found and fixed while verifying in a live browser** (exactly the "new bundling territory" risk flagged in slice 6's plan):

1. **Production build failure:** Vite's default `iife` worker output format can't support the top-level await pulled in transitively by `satellite.js`'s optional WASM build. Fixed with `worker: { format: 'es' }` + `build: { target: 'es2022' }` in `vite.config.ts` (the app already requires Web Serial — Chromium-only, recent versions — so this isn't a meaningful new browser-support constraint).
2. **Dev-server-only failure:** Vite's esbuild dependency pre-bundler hung/504'd specifically on `satellite.js` (Node-only `#wasm-*` subpath imports in its `package.json` "imports" map, never actually invoked by this app, seemingly confuse esbuild's scanner). Fixed with `optimizeDeps: { exclude: ['satellite.js'] }` — it's pure ESM already, so Vite serves it directly without pre-bundling.

**Verify**

- Live-tested end-to-end in a real browser against the live CelesTrak-fetched satellite set (~90 enabled satellites): observer location persisted and displayed correctly; **2185+ real computed passes** rendered via the actual Web Worker (not mocked) — confirmed real orbital mechanics results (e.g. a correctly-handled geostationary edge case for Es'hail 2/QO-100 spanning the full 72h window as one continuous pass, since it never sets below the horizon).
- `npx vitest run` — 2516 tests passing. `npx tsc --noEmit -p tsconfig.app.json` — 0 errors. `npm run build` — succeeds, emits a genuine separate `passPredictionWorker-*.js` chunk (~22 kB) now that something actually imports the client. Lint/format clean.

---

## Slice 8: 2D ground-track map (#867)

**Status:** Complete (pending merge)

**Delivered**

- `src/core/domain/satelliteTracking/groundTrack.ts` — pure `sampleGroundTrack(tleLine1, tleLine2, fromAt, toAt, stepSec)` (30s default step), reusing the same satellite.js propagation chain as `passPrediction.ts`; returns the shared `LatLon` type from `src/core/domain/geo.ts`.
- `src/app/components/SatelliteTrackMap/SatelliteTrackMap.tsx` (+ sidecar) — new sibling to `CodeplugMap` (not an extension of it), react-leaflet `MapContainer`/`TileLayer`/`Polyline` + observer `L.divIcon` marker, auto-fit via the shared `computeMapView` helper. **Antimeridian handling:** the track is split into separate `Polyline` segments wherever consecutive samples' longitude delta exceeds 180° — verified against ES'HAIL 2's (geostationary, effectively fixed longitude) and a LEO pass in the live browser check.
- `PassGrid` row click (`onRowActivate`) → `TrackingDashboardPage` holds `selectedPass` state → `SatelliteTrackMap` draws that specific pass's AOS→LOS ground track.
- **No 3D/2D toggle** — no 3D globe exists in this plan's scope (#866 deferred); noted explicitly in the hub's Out of scope section rather than shipping a dead control.

**Verify**

- `computeGroundTrack` unit-tested (valid lat/lon range at every step; satellite genuinely moves between samples — not a stationary/broken propagation).
- Live-verified in a real browser: clicked a real pass row (CUBESAT XI-V) and confirmed a real SVG polyline rendered on the Leaflet map with the observer marker, auto-fit to show both.
- `npx vitest run` — 2518 tests passing. `npx tsc --noEmit -p tsconfig.app.json` — 0 errors. `npm run build` — succeeds, worker chunk unaffected. Lint/format clean.

---

**All 8 slices of the satellite-keps/satellite-tracking MVP plan are complete.** An operator can: refresh and curate a satellite library from CelesTrak/AMSAT, set an observer location, see upcoming passes for enabled satellites computed off the main thread, and preview any pass's ground track on a 2D map — all live-verified end-to-end against real orbital data in a real browser.

---

## Next

- Blocked on Milestone A (satellite-keps library, #850–#853) landing first in the same branch.

---

## Slice 9: Satellite detail page (#1002, phases 8a/8b/8c)

**Status:** Complete — umbrella #1002 closed by phase 8c.

Three-PR arc adding a per-satellite detail page reachable from the Satellite Keps list and the Tracking Dashboard pass grid, split because it was substantial:

- **8a — route shell + detail panel + pass lists (#1003):** `/tracking/satellites/:satelliteId` route (`SatelliteDetailPage.tsx`); static `SatelliteDetailPanel` (decoded Keplerian fields, uplink/downlink/tone metadata from #854); `usePassesForSatellite` hook (extracted, shared with `useTrackingPasses.ts`) driving future/past pass lists (`SatellitePassList.tsx`) over the existing SGP4 Worker plumbing.
- **8b — live position + footprint circle math (#1005):** `src/core/domain/satelliteTracking/footprint.ts` — pure `computeSatelliteFootprint`, matching `passPrediction.ts`/`groundTrack.ts`'s hand-rolled great-circle style (radio-horizon angular radius from altitude, `sampleGreatCircle` bearing walk). `useLiveSatellitePosition` hook (`src/app/routes/tracking/`) polling `satellite.js` `propagate` every 2s. Extracted `SatelliteTrackMap`'s antimeridian-split and marker-icon helpers into `SatelliteTrackMap/mapHelpers.ts` for reuse — no map rendering yet.
- **8c — orbit trails + live map component (#1007, this slice):** `src/app/components/SatelliteLiveMap/orbitTrail.ts` — pure `computeOrbitTrailSegments`, deriving `periodMinutes = 1440 / meanMotionRevPerDay` and sampling 1.5 orbits ahead/behind via `sampleGroundTrack`, antimeridian-split **independently** per segment (not as one combined polyline — the two windows are non-adjacent). New `SatelliteLiveMap` component (sibling to `SatelliteTrackMap`, not a mode-switch on it) composing the live marker, footprint circle, and both trail segments; wired into `SatelliteDetailPage` as the page's map.

**Delivered:** an operator can open any library satellite's detail page and see its orbital elements, uplink/downlink metadata, upcoming/past passes, and a live 2D map showing the current subsatellite position, its visible-horizon footprint, and 1.5-orbit ahead/behind ground tracks (solid/dashed) — all client-side, no backend.

**Verify (8c):** `computeOrbitTrailSegments` unit-tested (valid lat/lon at every sample; sample count matches the expected 1.5-period window; antimeridian split boundaries are genuine >180° longitude jumps, future and past checked independently). `SatelliteLiveMap` component-tested with a mocked `useLiveSatellitePosition` and mocked `react-leaflet` primitives (live marker, footprint segment(s), and both trail-segment kinds render; hint text and no marker before the first live position resolves). Live-verified in a real browser: opened a real satellite's detail page, watched the amber marker move over successive polls, confirmed the footprint circle rendered as a plausible circle, and confirmed the solid/dashed split between the future and past trail segments.

**Out of scope (deferred):** 3D globe rendering (#866) — depends on this slice for `footprint.ts` and the orbit-period math instead of re-deriving them.

---

## Slice 10: 3D orbital globe (#866) — final phase

**Status:** Complete — closes out the Tracking Dashboard epic (#860).

- **`react-globe.gl` + `three`** added as new dependencies — a visible bundle-size increase, tracked in the PR description as an intentional trade-off.
- **`src/app/components/SatelliteGlobe/`** — new component, sibling to `SatelliteLiveMap` rather than a shared abstraction (a 3D globe handles antimeridian wraparound natively, so none of `SatelliteTrackMap/mapHelpers.ts`'s splitting logic applies, and this component tracks many satellites at once instead of one):
  - `useLiveSatellitePositions.ts` — multi-satellite sibling to the single-satellite `useLiveSatellitePosition` hook from slice 9 (8b); calling that hook once per array entry would violate the rules of hooks, so this variant shares one poll interval across all enabled satellites.
  - `orbitTrail.ts#computeGlobeOrbitTrail` — ~90-minute window (one full orbital period, not slice 9's 1.5-orbit window), still derived per-satellite via `periodMinutes = 1440 / meanMotionRevPerDay` and `sampleGroundTrack`.
  - `computeSatelliteFootprint` (slice 9 / 8b) reused directly for the footprint circle, no reimplementation.
  - `buildGlobeData.ts` — pure `pointsData`/`pathsData` computation, kept separate from the component so it's unit-testable without a WebGL context.
- **Click-to-filter:** `PassGrid`'s satellite multi-select filter state was lifted from local `useState` up to `TrackingDashboardPage` (with an uncontrolled fallback so `PassGrid.test.tsx` needed no changes) so `SatelliteGlobe` and `PassGrid` share it — clicking a satellite dot on the globe narrows the grid.
- **Follow-up filed:** [#1009](https://github.com/pskillen/codeplug-studio/issues/1009) — 3D/2D viewport toggle, newly unblocked now both viewports exist, but out of this ticket's scope.

**Verify:** `SatelliteGlobe.test.tsx` mocks `react-globe.gl` to a stub component and asserts the `pointsData`/`pathsData`/`onPointClick` props it's called with (state/prop wiring, not rendered 3D output — WebGL doesn't run in jsdom). Live-verified in a real browser: globe rendered with the Earth texture, observer marker, live-moving satellite dots, visible orbit trails and footprint circles, and confirmed a globe click narrows the pass grid.

**This closes the satellite-tracking epic's post-MVP follow-up series (#860) — every child ticket filed for the epic (#862, #863, #864, #865/#980, #866, #867/#998, #1002/#1003/#1005/#1007) has shipped, aside from the newly-filed #1009 toggle follow-up.**

---

## Wave 1 post-MVP polish

**Plan:** `satellite_wave_1_fixes` — five stacked PRs from [follow-up-tickets.md](../../../tmp/features/satellite-followups/follow-up-tickets.md). Merge in order (#1025 → #1026 → #1027 → #1028 → #1029).

| Phase | Issue | Status |
| --- | --- | --- |
| 1 | [#1012](https://github.com/pskillen/codeplug-studio/issues/1012) SatNOGS UI wiring | PR [#1025](https://github.com/pskillen/codeplug-studio/pull/1025) |
| 2 | [#1013](https://github.com/pskillen/codeplug-studio/issues/1013) Globe code-split | PR [#1026](https://github.com/pskillen/codeplug-studio/pull/1026) |
| 3 | [#1016](https://github.com/pskillen/codeplug-studio/issues/1016) Dashboard layout | PR [#1027](https://github.com/pskillen/codeplug-studio/pull/1027) |
| 4 | [#1018](https://github.com/pskillen/codeplug-studio/issues/1018) Map camera fit | PR [#1028](https://github.com/pskillen/codeplug-studio/pull/1028) |
| 5 | [#1019](https://github.com/pskillen/codeplug-studio/issues/1019) World-copy pass lines | PR [#1029](https://github.com/pskillen/codeplug-studio/pull/1029) |
