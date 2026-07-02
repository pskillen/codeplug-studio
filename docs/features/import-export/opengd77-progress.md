# OpenGD77 CSV — progress

**Tracking:** [#36](https://github.com/pskillen/codeplug-studio/issues/36)  
**Epic:** Phase 4 build + export ([#85](https://github.com/pskillen/codeplug-studio/issues/85)–[#91](https://github.com/pskillen/codeplug-studio/issues/91))  
**Foundation:** Phase 4a ([#82](https://github.com/pskillen/codeplug-studio/issues/82)–[#84](https://github.com/pskillen/codeplug-studio/issues/84))

---

## Overall status

| Phase                                                  | Status                   | PR                                                         |
| ------------------------------------------------------ | ------------------------ | ---------------------------------------------------------- |
| 4a — build shell, profiles, format catalog             | Complete                 | [#94](https://github.com/pskillen/codeplug-studio/pull/94) |
| 4 — MVP CPS export (adapter + download UI + Drive ZIP) | Complete (pending merge) | [#95](https://github.com/pskillen/codeplug-studio/pull/95) |

**Branch:** `85/pskil/opengd77-build-export`

MVP export intentionally omits zone editor ([#87](https://github.com/pskillen/codeplug-studio/issues/87)), multi-mode expansion ([#89](https://github.com/pskillen/codeplug-studio/issues/89)), and name shortening ([#90](https://github.com/pskillen/codeplug-studio/issues/90)).

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

**Status:** Complete (pending merge)  
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

One row per channel via first `modeProfile` until [#89](https://github.com/pskillen/codeplug-studio/issues/89).

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
- Replaces `ExportBuildCpsPanelStub` on `/builds/:id`
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

**Verify**

- [ ] Open OpenGD77 build with library channels → **Download ZIP** → six CSVs in archive
- [ ] Per-file CSV download buttons
- [ ] Export warnings when wire names exceed profile `nameLimit`
- [ ] **Save ZIP to Drive** (connected Google account)
- [x] `npm run lint`, `npm run test`, `npm run build`

---

## Next

- [#87](https://github.com/pskillen/codeplug-studio/issues/87) — zone grouping build editor
- [#89](https://github.com/pskillen/codeplug-studio/issues/89) — multi-mode channel expansion at export
- [#90](https://github.com/pskillen/codeplug-studio/issues/90) — export name shortening pipeline
- Phase 4b — OpenGD77 CPS import (Import / export format catalog)
