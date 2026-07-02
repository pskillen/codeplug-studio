# OpenGD77 CSV — progress

**Tracking:** [#36](https://github.com/pskillen/codeplug-studio/issues/36)  
**Epic:** Phase 4 build + export ([#85](https://github.com/pskillen/codeplug-studio/issues/85)–[#91](https://github.com/pskillen/codeplug-studio/issues/91))  
**Foundation:** Phase 4a ([#82](https://github.com/pskillen/codeplug-studio/issues/82)–[#84](https://github.com/pskillen/codeplug-studio/issues/84))

---

## Overall status

| Phase                                                  | Status   | PR / branch                                                                                                                                                                                                              |
| ------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 4a — build shell, profiles, format catalog             | Complete | [#94](https://github.com/pskillen/codeplug-studio/pull/94)                                                                                                                                                               |
| 4 — MVP CPS export (adapter + download UI + Drive ZIP) | Complete | [#95](https://github.com/pskillen/codeplug-studio/pull/95)                                                                                                                                                               |
| Wire preview + export shaping                          | Complete | `87/pskil/build-wire-preview` — [#87](https://github.com/pskillen/codeplug-studio/issues/87), [#89](https://github.com/pskillen/codeplug-studio/issues/89), [#90](https://github.com/pskillen/codeplug-studio/issues/90) |

**Branch:** `87/pskil/build-wire-preview`

---

## Phase 4a foundation

**Status:** Complete  
**PR:** [#94](https://github.com/pskillen/codeplug-studio/pull/94)  
**Branch:** `82/pskil/phase-4a-build-foundation`

| Slice                              | Status   | Notes                                                            |
| ---------------------------------- | -------- | ---------------------------------------------------------------- |
| Progress pair kickoff              | Complete | This file + `opengd77-outstanding.md`                            |
| OpenGD77 radio profiles (#84)      | Complete | `profiles.ts`, `formatProfiles.ts`, trait `opengd77-md9600`      |
| Format build shell (#82)           | Complete | `/builds` routes, `BuildService`, builds hub docs                |
| Import/export format catalog (#83) | Complete | `FormatCatalogPanel`; CPS export relocated to build detail (#94) |
| Post-plan UX (#94)                 | Complete | **Radio builds** nav; export pointer on Import / export          |

**Plan deviation (inform follow-on):** CPS export UI moved from Import / export to per-build detail on Radio builds. `ExportBuildSelectorStub` deleted; export panel lives under `src/app/components/builds/`.

---

## Phase 4 — MVP export

**Status:** Complete  
**PR:** [#95](https://github.com/pskillen/codeplug-studio/pull/95)  
**Branch:** `85/pskil/opengd77-build-export`

| Slice                             | Issue                                                        | Status   |
| --------------------------------- | ------------------------------------------------------------ | -------- |
| ProfilePicker                     | [#85](https://github.com/pskillen/codeplug-studio/issues/85) | Complete |
| `assemble` + `exportBuild`        | [#86](https://github.com/pskillen/codeplug-studio/issues/86) | Complete |
| OpenGD77 export adapter           | [#88](https://github.com/pskillen/codeplug-studio/issues/88) | Complete |
| Browser download + ZIP helpers    | (plan slice 4)                                               | Complete |
| ExportBuildCpsPanel UI            | [#91](https://github.com/pskillen/codeplug-studio/issues/91) | Complete |
| Google Drive ZIP upload           | (plan slice 9)                                               | Complete |
| Export tests + `csvRecordCompare` | (plan slice 10)                                              | Complete |

### Slice — ProfilePicker ([#85](https://github.com/pskillen/codeplug-studio/issues/85))

**Status:** Complete

**Delivered**

- `ProfilePicker` component + sidecar
- New build wizard and build detail Target profile edit (layout guardrail)
- Export panel shows saved profile read-only — change profile in Target section
- `docs/features/builds/profiles.md`

### Slice — `assemble` + `exportBuild` ([#86](https://github.com/pskillen/codeplug-studio/issues/86))

**Status:** Complete

**Delivered**

- `src/core/services/assemble.ts` + tests
- `src/core/services/exportBuild.ts` — per-file and ZIP bytes
- `docs/features/import-export/cps-services.md`

### Slice — OpenGD77 export adapter ([#88](https://github.com/pskillen/codeplug-studio/issues/88))

**Status:** Complete

**Delivered**

- `serialise.ts`, `channelWire.ts`, `listWire.ts`, `warnings.ts`, `adapter.ts`, `columns.ts`, `csvWrite.ts`
- Registry: OpenGD77 `exportStatus: shipped`
- `serialise.test.ts` — directional export from assemble fixture
- `docs/features/import-export/opengd77/export-mapping.md`

### Slice — Browser download + ZIP

**Status:** Complete

**Delivered**

- `fflate` dependency
- `src/integrations/download/browserDownload.ts`
- `src/core/import-export/formats/opengd77/packageZip.ts`
- `src/app/services/buildCpsExportService.ts` — `downloadCpsFile`, `downloadCpsZip`

### Slice — ExportBuildCpsPanel ([#91](https://github.com/pskillen/codeplug-studio/issues/91))

**Status:** Complete

**Delivered**

- `ExportBuildCpsPanel` — per-file CSV buttons, ZIP download, export warnings
- `/builds/:id/export` route
- `ExportBuildCpsPanel.test.tsx`, component sidecar

### Slice — Google Drive ZIP upload

**Status:** Complete

**Delivered**

- `driveApi.writeBinaryFile` + `googleDrivePort.writeBinaryFile`
- `DriveBrowserModal` — `saveConflictKind: zip` for overwrite detection
- `buildCpsExportService.uploadCpsZipToDrive`
- Save ZIP to Drive on export panel

### Slice — Export tests

**Status:** Complete

**Delivered**

- `src/test/csvRecordCompare.ts` + `csvParse.ts`
- `warnings.test.ts`, extended `serialise.test.ts`
- `buildCpsExportService.test.ts`, `driveApi` binary upload tests

---

## Wire preview + export shaping

**Status:** Complete  
**Branch:** `87/pskil/build-wire-preview`  
**Issues:** [#87](https://github.com/pskillen/codeplug-studio/issues/87), [#89](https://github.com/pskillen/codeplug-studio/issues/89), [#90](https://github.com/pskillen/codeplug-studio/issues/90)

| Slice                             | Status   | Notes                                                       |
| --------------------------------- | -------- | ----------------------------------------------------------- |
| `BuildEntityOverride` + schema v3 | Complete | Sparse opt-out overrides; YAML migration                    |
| Build sub-routes + section nav    | Complete | `/builds/:id/*` wire pages + export                         |
| `previewWireRows` service         | Complete | Shared preview projection                                   |
| Multi-mode expansion              | Complete | `-F`/`-D` rows in preview + `serialise.ts`                  |
| Name shortening pipeline          | Complete | Dictionary, `useExportSettings`, export panel               |
| Wire preview UI + zone editor     | Complete | `WirePreviewTable`, `BuildZoneLayoutEditor`                 |
| Docs + tests                      | Complete | `wire-preview.md`, `zone-grouping.md`, `name-shortening.md` |

**Verify**

- [ ] Channel wire preview — include toggle, wire name override, multi-mode rows
- [ ] Zones page — seed layout, reorder members, zone wire names
- [ ] Export page — name settings affect ZIP download wire names
- [x] `npm run lint`, `npm run test`, `npm run build`

---

## Next

- Phase 4b — OpenGD77 CPS import (Import / export format catalog)
- Model review chore — [#99](https://github.com/pskillen/codeplug-studio/issues/99)
