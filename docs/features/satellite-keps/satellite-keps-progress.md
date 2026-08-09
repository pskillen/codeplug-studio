# Satellite keps — progress

**Tracking:** [codeplug-studio#848](https://github.com/pskillen/codeplug-studio/issues/848)
**Plan:** `/Users/patricks/.claude/plans/epic-satellite-keps-support-atomic-charm.md`
**Branch:** `848/pskillen/satellite-keps-and-tracking-mvp`

---

## Overall status

**Status:** In progress

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

**Status:** Not started

---

## Next

- Start Slice 1 (core TLE parser + orbital model).
