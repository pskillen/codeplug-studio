# Epic 1 — gaps

Items **skipped**, **incomplete**, or **discovered during execution** — not future plan phases.

**Tracking:** [codeplug-studio#1](https://github.com/pskillen/codeplug-studio/issues/1) · Phase 0: [#2](https://github.com/pskillen/codeplug-studio/issues/2) · Phase 1: [#4](https://github.com/pskillen/codeplug-studio/issues/4) · Phase 2: [#8](https://github.com/pskillen/codeplug-studio/issues/8)–[#12](https://github.com/pskillen/codeplug-studio/issues/12)

**Progress:** [epic-1-progress.md](epic-1-progress.md)

---

## Phase 0 / DESIGN.md

- [x] Trait enum and profile → trait matrix — `BuildCapabilityTrait` + `TRAIT_PROFILES` stub in Phase 1
- [x] Trait layout — discriminated union stub (`ZoneGroupingLayout`, `FlatMemoryLayout`) in `traitLayout.ts`
- [x] Zones — **library entities** (`Zone` row); builds reference via `zoneSelections`
- [x] `version-number` cursor skill — shipped in scaffold PR

## Phase 1 modelling deferrals

- [ ] Channel field encyclopedia — slim model only; expand in Phase 2 CRUD
- [ ] m×n channel expansion — export-time projection only; not persisted in `FormatBuild.layout` until a format phase needs it
- [ ] Trait profile registry — placeholder profiles only; flesh out per format phase
- [ ] GitHub Pages — enable in repo settings (operator task) before first release deploy

## Phase 2 — documentation (discovered)

- [x] **Epic progress log gap** — Phase 2 backfilled: retrospective slices for PRs #13–#15 and the PR #17 mop-up added to `epic-1-progress.md` (#18, 2026-07-01)
- [x] **Hallucinated `reports-and-reference` feature doc** — removed; repeater content lives under [repeater-directories](../features/repeater-directories/README.md); report and reference split into [report](../features/report/README.md) + [maidenhead.md](../features/maidenhead.md) + tier-2 [bands](../reference/bands.md) ([#26](https://github.com/pskillen/codeplug-studio/issues/26))
- [x] **App shell feature doc drift** — `/summary` (library summary; `/reports` redirects) and `/reference` (tools) confirmed as shipped Ticket #12 surfaces (PR #15) and documented in their own hubs; app-shell route table links to them

## Phase 2 — repeater directories (discovered)

- [x] **Multi-mode channel CRUD** — [#16](https://github.com/pskillen/codeplug-studio/issues/16)
- [x] **Typed digital profiles** — D-STAR, YSF, NXDN, TETRA (P25/M17 remain stubs) — [#16](https://github.com/pskillen/codeplug-studio/issues/16)
- [x] **`maidenheadLocator` on channels** — [#28](https://github.com/pskillen/codeplug-studio/issues/28)
- [x] **UK repeater search modes** — geocode/town, band, unified query ([#43](https://github.com/pskillen/codeplug-studio/issues/43)); keeper endpoint still deferred
- [ ] **Repeater result cache** — no offline/session cache beyond in-memory search results

## Phase 2 — library / shell (discovered)

- [x] **Channel editor** — multi-mode profiles + location ([#16](https://github.com/pskillen/codeplug-studio/issues/16), [#28](https://github.com/pskillen/codeplug-studio/issues/28))
- [x] **DataTable** — all library list routes use ported `DataTable` ([#20](https://github.com/pskillen/codeplug-studio/issues/20) / PR [#41](https://github.com/pskillen/codeplug-studio/pull/41))
- [ ] **Entity editors styling** — talk groups, contacts, zones still on pre-Mantine inline patterns on some routes
