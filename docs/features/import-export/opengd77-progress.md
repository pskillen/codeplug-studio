# OpenGD77 CSV — progress

**Tracking:** [#36](https://github.com/pskillen/codeplug-studio/issues/36) · Phase 4a [#82](https://github.com/pskillen/codeplug-studio/issues/82)–[#84](https://github.com/pskillen/codeplug-studio/issues/84)
**Plan:** Phase 4a foundation — builds shell, format catalog, OpenGD77 profiles
**Branch:** `82/pskil/phase-4a-build-foundation`

---

## Overall status

**Status:** Complete — [#94](https://github.com/pskillen/codeplug-studio/pull/94) (includes post-plan CPS export UX revision)

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

**Status:** Complete (revised — see **Plan deviations** below)

**Delivered**

- `FormatCatalogPanel`, `CpsFormatCatalogGrid`
- `useFormatParam` — `?format=` deep link
- Import/export page redesign (native YAML + CPS catalog)
- ~~`ExportBuildSelectorStub` on import/export~~ → moved to build detail (post-plan UX pass)

---

## Post-plan UX — CPS export on Radio builds (#94 follow-up)

**Status:** Complete

**Delivered**

- Sidebar: **Radio builds** label; order Library → Summary → Radio builds → Import / export
- `ExportBuildCpsPanelStub` on `/builds/:id` (replaces import/export build selector)
- Import/export **Export to CPS** section retained as pointer to Radio builds
- Removed `ExportBuildSelectorStub`

---

## Plan deviations (inform follow-on tickets)

Original Phase 4a plan assumed CPS **export** UI on `/import-export` via `ExportBuildSelectorStub`. After shipping, export was relocated:

| Plan assumption                                  | Shipped behaviour                                                      | Impact on follow-on                                                                                                                                                                    |
| ------------------------------------------------ | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Export build selector on Import / export         | Per-build export stub on **Radio builds** detail page only             | [#86](https://github.com/pskillen/codeplug-studio/issues/86) / export adapter UI: wire download on `BuildDetailPage`, not `ImportExportPage`                                           |
| Nav: Library, Builds, Import/export, Summary     | Nav: Library, **Summary**, **Radio builds**, Import/export             | Sidebar label is **Radio builds**; routes/code remain `/builds`, `BuildService`, etc.                                                                                                  |
| Ticket #83 “export section: build selector stub” | Import/export keeps **Export to CPS** heading + link to Radio builds   | #83 acceptance met for import catalog; export stub scope moved to builds hub                                                                                                           |
| `ExportBuildSelectorStub` component              | Deleted — use `ExportBuildCpsPanelStub` (`src/app/components/builds/`) | Profile picker ([#85](https://github.com/pskillen/codeplug-studio/issues/85)) and CPS export panel ([#88+](https://github.com/pskillen/codeplug-studio/issues/36)) target build detail |

CPS **import** placeholders remain on Import / export (format catalog grid). Only **export** moved to Radio builds.

---

## Next

- Phase 4 export UI — branch `85/pskil/opengd77-build-export`

---

## Slice 5 — ProfilePicker ([#85](https://github.com/pskillen/codeplug-studio/issues/85))

**Status:** Complete

**Delivered**

- `ProfilePicker` component + sidecar
- New build wizard and build detail profile edit with layout guardrail
- Export panel export-time profile override (stub)
- `docs/features/builds/profiles.md`
