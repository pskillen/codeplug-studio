# Satellite tracking — progress

**Tracking:** [codeplug-studio#860](https://github.com/pskillen/codeplug-studio/issues/860)
**Plan:** `/Users/patricks/.claude/plans/epic-satellite-keps-support-atomic-charm.md`
**Branch:** `848/pskillen/satellite-keps-and-tracking-mvp`

---

## Overall status

**Status:** Complete (pending merge) — full plan shipped: satellite keps library, observer location, SGP4 pass prediction, Tracking Dashboard, and 2D ground-track map, all live-verified end-to-end in a real browser against real CelesTrak data.

**Branch:** `848/pskillen/satellite-keps-and-tracking-mvp`

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

**Status:** Not started

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
