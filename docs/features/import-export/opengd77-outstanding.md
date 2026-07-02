# OpenGD77 CSV — outstanding

Items **skipped**, **incomplete**, or **discovered during execution** — not the plan's future phases.

**Tracking:** [#36](https://github.com/pskillen/codeplug-studio/issues/36) · branch `85/pskil/opengd77-build-export`

---

## Pre-existing model debt

- [ ] Library `Zone` carries OpenGD77-shaped export fields (`exportScratchChannel`, `exportScanList`, `scanCarrierFrequencyHz`) — zone-as-scan-list belongs on `FormatBuild.layout`, not the library entity ([library-and-builds.mdc](../../../.cursor/rules/library-and-builds.mdc))

---

## Deferred to follow-on (not in current PR scope)

- [ ] Zone-grouping build editor ([#87](https://github.com/pskillen/codeplug-studio/issues/87))
- [ ] Multi-mode channel expansion at export ([#89](https://github.com/pskillen/codeplug-studio/issues/89))
- [ ] Export name shortening pipeline ([#90](https://github.com/pskillen/codeplug-studio/issues/90))
- [ ] `ExportBuildCpsPanel` download UI on `/builds/:id` ([#91](https://github.com/pskillen/codeplug-studio/issues/91)) — wire `buildCpsExportService` to replace stub
- [ ] Google Drive CPS ZIP upload (build detail)
- [ ] Extended export golden tests beyond `serialise.test.ts`
- [ ] OpenGD77 CPS import (Phase 4b) — remains on Import / export format catalog

---

## Shipped in current branch (for reference)

- [x] `ProfilePicker` ([#85](https://github.com/pskillen/codeplug-studio/issues/85))
- [x] `assemble` / `exportBuild` ([#86](https://github.com/pskillen/codeplug-studio/issues/86))
- [x] OpenGD77 export adapter core ([#88](https://github.com/pskillen/codeplug-studio/issues/88))
- [x] `downloadCpsFile` / `downloadCpsZip` service helpers (no UI buttons yet)
