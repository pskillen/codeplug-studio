# Epic 1 — gaps

Items **skipped**, **incomplete**, or **discovered during execution** — not future plan phases.

**Tracking:** [codeplug-studio#1](https://github.com/pskillen/codeplug-studio/issues/1) · Phase 0: [#2](https://github.com/pskillen/codeplug-studio/issues/2) · Phase 1: [#4](https://github.com/pskillen/codeplug-studio/issues/4)

---

## Phase 0 / DESIGN.md

- [x] Trait enum and profile → trait matrix — `BuildCapabilityTrait` + `TRAIT_PROFILES` stub in Phase 1
- [x] Trait layout — discriminated union stub (`ZoneGroupingLayout`, `FlatMemoryLayout`) in `traitLayout.ts`
- [x] Zones — **build-scoped** via `TraitLayout`, not library entities
- [x] `version-number` cursor skill — shipped Phase 1

## Phase 1 modelling deferrals

- [ ] Channel field encyclopedia — slim model only; expand in Phase 2 CRUD
- [ ] m×n channel expansion — export-time projection only; not persisted in `FormatBuild.layout` until a format phase needs it
- [ ] Trait profile registry — placeholder profiles only; flesh out per format phase
- [ ] GitHub Pages — enable in repo settings (operator task) before first release deploy
