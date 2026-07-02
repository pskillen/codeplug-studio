# OpenGD77 CSV — outstanding

Items **skipped**, **incomplete**, or **discovered during execution** — not the plan's future phases.

**Tracking:** [#36](https://github.com/pskillen/codeplug-studio/issues/36) · Phase 4a [#82](https://github.com/pskillen/codeplug-studio/issues/82)–[#84](https://github.com/pskillen/codeplug-studio/issues/84)

---

## Pre-existing model debt

- [ ] Library `Zone` carries OpenGD77-shaped export fields (`exportScratchChannel`, `exportScanList`, `scanCarrierFrequencyHz`) — zone-as-scan-list belongs on `FormatBuild.layout`, not the library entity ([library-and-builds.mdc](../../../.cursor/rules/library-and-builds.mdc))

---

## Deferred to follow-on tickets

- [ ] Reusable `ProfilePicker` component ([#85](https://github.com/pskillen/codeplug-studio/issues/85))
- [ ] `assemble` / `exportBuild` services ([#86](https://github.com/pskillen/codeplug-studio/issues/86))
- [ ] Zone-grouping build editor ([#87](https://github.com/pskillen/codeplug-studio/issues/87))
- [ ] OpenGD77 export adapter and CPS download UI — **integrate on `/builds/:id`**, not `/import-export` (see [opengd77-progress.md](opengd77-progress.md) plan deviations)
- [ ] OpenGD77 CPS import (Phase 4b) — remains on Import / export format catalog
