# OpenGD77 CSV — progress

**Tracking:** [#36](https://github.com/pskillen/codeplug-studio/issues/36) · Phase 4a [#82](https://github.com/pskillen/codeplug-studio/issues/82)–[#84](https://github.com/pskillen/codeplug-studio/issues/84)
**Plan:** Phase 4a foundation — builds shell, format catalog, OpenGD77 profiles
**Branch:** `82/pskil/phase-4a-build-foundation`

---

## Overall status

**Status:** Complete — [#94](https://github.com/pskillen/codeplug-studio/pull/94)

**Branch:** `82/pskil/phase-4a-build-foundation`

---

## Slice 1 — Progress tracking kickoff

**Status:** Complete

**Delivered**

- Progress and outstanding log pair created

---

## Slice 2 — OpenGD77 radio profiles (#84)

**Status:** Complete

**Delivered**

- `src/core/import-export/profileLadder.ts`
- `src/core/import-export/formats/opengd77/profiles.ts` + tests
- `src/core/import-export/formatProfiles.ts` — `getFormatProfiles('opengd77')`
- `TRAIT_PROFILES` — `opengd77-md9600`
- `docs/features/import-export/opengd77/README.md`

---

## Slice 3 — Format build shell (#82)

**Status:** Complete

**Delivered**

- `BuildService`, `useFormatBuilds`, `/builds` routes + nav
- `docs/features/builds/README.md`

---

## Slice 4 — Import/export format catalog (#83)

**Status:** Complete

**Delivered**

- `FormatCatalogPanel`, `CpsFormatCatalogGrid`, `ExportBuildSelectorStub`
- `useFormatParam` — `?format=` deep link
- Import/export page redesign

---

## Next

- Merge [#94](https://github.com/pskillen/codeplug-studio/pull/94)
- Follow-on: #85 ProfilePicker, #86 assemble, #87 zone editor
