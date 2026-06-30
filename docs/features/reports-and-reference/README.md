# Reports & reference tools

Tier-1 reference for the Phase 2 **reports** summary and **reference** tools.

**Tracking:** Phase 2 [#12](https://github.com/pskillen/codeplug-studio/issues/12) (Epic [#1](https://github.com/pskillen/codeplug-studio/issues/1))

**Source:** `src/app/routes/ReportsPage.tsx`, `src/app/routes/ReferencePage.tsx`, `src/core/domain/summary.ts`, `src/core/domain/bandPlan.ts`, `src/core/domain/maidenhead.ts`

## Reports (`/reports`)

Read-only projection over the active project's library via `summariseLibrary` (pure, in `core`):

- Entity counts per kind.
- Channels by mode and by band (`bandLabelForFrequencyHz`).
- Count of channels with a location.
- **Integrity warnings** — dangling UUID references found by `findDanglingReferences` (a foreign key pointing at a missing entity).

## Reference (`/reference`)

Domain-neutral amateur radio helpers (no CPS/format data):

- **Maidenhead locator** — two-way locator ↔ coordinates (`locatorToCoords`, `coordsToLocator`).
- **Frequency → band** lookup (`bandForFrequencyHz`).
- **Band plan** table — UK amateur allocations plus a few common services, for programming convenience only (not authoritative for on-air operation).

## Boundaries

- All computation is pure `core` domain logic (tier-2 RF facts); the pages are thin `app` views.
- No format wire tables here — those belong under `docs/reference/<format>/` in later phases.

## Related

- [map-and-repeaters](../map-and-repeaters/README.md) · [library](../library/README.md)
