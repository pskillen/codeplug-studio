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

- [ ] **Epic progress log gap** — `epic-1-progress.md` had no Phase 2 section until mop-up (2026-06-30); remaining tickets (#9, #10, #12) still need slice-level entries when verified
- [x] **Hallucinated `reports-and-reference` feature doc** — removed; repeater content lives under [repeater-directories](../features/repeater-directories/README.md)
- [ ] **App shell feature doc drift** — `docs/features/app-shell/README.md` still lists `/reports` and `/reference` as Ticket #12 deliverables; update when #12 is scoped or routes removed

## Phase 2 — repeater directories (discovered)

- [ ] **Multi-mode channel CRUD** — import creates multiple `modeProfiles`; channel editor overwrites with single FM/DMR on save → [#16](https://github.com/pskillen/codeplug-studio/issues/16)
- [ ] **Typed digital profiles** — D-STAR, YSF, P25, NXDN, M17, Tetra import as mode-only stubs; no dedicated `ChannelModeProfile*` types yet
- [ ] **UK repeater search modes** — postcode, address, keeper, band endpoints not wired (callsign + locator only)
- [ ] **Repeater result cache** — no offline/session cache beyond in-memory search results

## Phase 2 — library / shell (discovered)

- [ ] **Channel editor** — FM-or-DMR toggle does not reflect multi-profile channels (ties to #16)
- [ ] **DataTable** — library list pages still use basic tables, not ported DataTable from codeplug-tool
- [ ] **Entity editors styling** — talk groups, contacts, zones still on pre-Mantine inline patterns on some routes
