# Satellite keps — progress

**Tracking:** [codeplug-studio#848](https://github.com/pskillen/codeplug-studio/issues/848)
**Plan:** `/Users/patricks/.claude/plans/epic-satellite-keps-support-atomic-charm.md`
**Branch:** `848/pskillen/satellite-keps-and-tracking-mvp`

---

## Overall status

**Status:** Milestone A complete (pending merge) — Satellite Keps library shippable end-to-end

**Branch:** `848/pskillen/satellite-keps-and-tracking-mvp`

---

## Slice 1: Core TLE parser + orbital model (#850)

**Status:** Complete (pending merge)

**Delivered**

- `src/core/models/satellite.ts` — vendor-neutral `Satellite` model; raw `tleLine1`/`tleLine2` are the persisted source of truth, decoded fields are display-only.
- `src/core/domain/tle/{parseTle,tleTypes}.ts` — fixed-column TLE parsing, modulo-10 checksum validation, collect-and-continue on malformed groups.
- `src/core/domain/tle/parseTle.test.ts` + `__fixtures__/{valid,invalid}.tle` — happy path + bad-checksum/truncated-line coverage.

**Verify**

- `npx vitest run src/core/domain/tle/` — 7/7 passing.
- No React/DOM import in the module (layer boundary respected).

---

## Slice 2: CelesTrak/AMSAT fetch proxy + client (#851)

**Status:** Complete (pending merge)

**Delivered**

- `functions/api/celestrak/amateur.ts`, `functions/api/amsat/nasabare.ts` — same-origin CORS bridge Pages Functions, mirroring `functions/api/irts/repeaters.ts`.
- `vite.config.ts` — matching local dev-proxy entries for both endpoints.
- `src/integrations/satellites/{types,rateLimit,sessionCache,directoryFetch,testHelpers}.ts` — mirrors the `src/integrations/repeaters/*` stack (cache TTL, 429 cooldown, stale-cache fallback).
- `src/integrations/satellites/{celestrakClient,amsatClient}.ts` — one function each, raw TLE text via `resolveApiUrl`.
- `src/integrations/satellites/fetchSatelliteSet.ts` — tries CelesTrak, falls back to AMSAT on any failure, feeds the result through `parseTleBlock` (#850).

**Verify**

- `npx vitest run src/integrations/satellites/` — 10/10 passing (cache hit/miss, refresh bypass, HTTP/network/429 failures, CelesTrak→AMSAT fallback).
- `npx vitest run src/integrations/http/ src/integrations/repeaters/` — 126/126 passing, no regressions from the shared `sessionCache.ts` prefix additions.

---

## Slice 3: Per-project persistence + schema bump (#852)

**Status:** Complete (pending merge)

**Delivered**

- `Satellite` wired through `Library`/`ProjectAggregate`; `STUDIO_SCHEMA_VERSION` 22 → 23 (generic `onupgradeneeded` auto-creates the new `satellites` store, no data-transform migration needed).
- Full CRUD (`getSatellite`/`putSatellite`/`putSatellitesBatch`/`listSatellites`) in both `IndexedDbProjectPersistence` and `InMemoryProjectPersistence`, wired into seed/replace/load-seed.
- `src/integrations/satellites/mergeSatelliteSet.ts` — merges a fresh fetch into the curated set keyed by NORAD id; preserves `id`/`enabled`/`revision` on match; keeps (does not delete) satellites missing from a fresh fetch.
- Native-yaml round-trip: `Satellite` added to `parseLibrary`/serialise/goldens; fixed a **pre-existing gap** where `AprsConfiguration` was never documented in `docs/reference/export-formats/native-yaml/README.md` despite round-tripping since schema v17 — documented both in the same pass.
- `registry.ts`/`references.ts` updated so `'satellite'` is a valid `LibraryEntityKind` (delete/reference-integrity plumbing only — list UI itself is slice 4).

**Verify**

- `npx tsc --noEmit -p tsconfig.app.json` — 0 errors.
- `npx vitest run` — 399 files / 2505 tests passing, 0 regressions.
- `npx eslint` / `npx prettier --check` — clean on all touched files.

---

## Slice 4: Satellite Keps library list UI (#853)

**Status:** Complete (pending merge)

**Delivered**

- `src/app/routes/library/lists/SatelliteKepsListPage.tsx` — new Library section tab; `DataTable` v2 (name/NORAD id/epoch/source/enable-toggle/delete), search, sort, empty states.
- "Update from CelesTrak/AMSAT" header action: `fetchSatelliteSet` → `mergeSatelliteSet` → `putSatellitesBatch`, then `ProjectMeta.satelliteLibraryLastUpdated` timestamp (stale-styled after 7 days).
- Nav wiring: `registry.ts` (`LIBRARY_KINDS` + `entitiesForKind`/`describeEntity` cases), `nav.ts` (`LIBRARY_NAV` entry), `contextualStripItems.ts` (the actual visible section-nav strip — separate from `LIBRARY_NAV`, easy to miss), `entityNavIcons.ts` (`IconPlanet`, distinct from `aprsConfiguration`'s `IconSatellite`), `App.tsx` route.
- No write-to-radio control anywhere on this page (explicitly out of scope for this plan — omitted, not a disabled placeholder).

**Bug caught and fixed during browser verification:** the "Last updated" indicator didn't update after a refresh because `ProjectProvider`'s `activeProject` is a snapshot loaded once (not re-fetched on every persistence change) — fixed by calling `refreshProjects()` after the `putProjectMeta` write in the refresh handler.

**Verify**

- Live-tested against the real CelesTrak endpoint via the Vite dev proxy (`GET /api/celestrak/amateur → 200`): fetched 97 real amateur satellites (ISS (ZARYA), SWISSCUBE, etc.), persisted, survived a full page reload.
- Confirmed the core acceptance criterion end-to-end: disabled a satellite, re-ran "Update from CelesTrak/AMSAT", confirmed `enabled: false` and the row count were preserved across the merge (no duplicate rows, count stayed at 97).
- Search/filter, sort, and delete (shared `EntityListRowDeleteAction`) all wired through already-tested shared components.
- `npx vitest run` — 399 files / 2505 tests passing. `npx tsc --noEmit -p tsconfig.app.json` — 0 errors. Lint/format clean.

---

**Milestone A (Satellite Keps library, #850–#853) is complete** — an operator can refresh, curate, and persist a satellite library end-to-end. Radio write (#854–#859) remains out of scope for this plan.

---

## Next

- Start Slice 1 (core TLE parser + orbital model).
