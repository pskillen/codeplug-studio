# Satellite tracking — progress

**Tracking:** [codeplug-studio#860](https://github.com/pskillen/codeplug-studio/issues/860)
**Plan:** `/Users/patricks/.claude/plans/epic-satellite-keps-support-atomic-charm.md`
**Branch:** `848/pskillen/satellite-keps-and-tracking-mvp`

---

## Overall status

**Status:** In progress — Milestone A (satellite-keps library) shipped; observer location settings (5a) shipped

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

**Status:** Not started

---

## Slice 7: Tracking Dashboard shell + pass grid (#865)

**Status:** Not started

---

## Slice 8: 2D ground-track map (#867)

**Status:** Not started

---

## Next

- Blocked on Milestone A (satellite-keps library, #850–#853) landing first in the same branch.
