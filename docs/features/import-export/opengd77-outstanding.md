# OpenGD77 CSV — outstanding

Items **skipped**, **incomplete**, or **discovered during execution** — not the plan's future phases.

**Tracking:** [#36](https://github.com/pskillen/codeplug-studio/issues/36) · branch `85/pskil/opengd77-build-export` · PR [#95](https://github.com/pskillen/codeplug-studio/pull/95)

---

## Pre-existing model debt

- [ ] Library `Zone` carries OpenGD77-shaped export fields (`exportScratchChannel`, `exportScanList`, `scanCarrierFrequencyHz`) — zone-as-scan-list belongs on `FormatBuild.layout`, not the library entity ([library-and-builds.mdc](../../../.cursor/rules/library-and-builds.mdc))

---

## MVP export scope ([#95](https://github.com/pskillen/codeplug-studio/pull/95))

Intentionally deferred from the MVP PR — tracked as GitHub issues, listed in [opengd77-progress.md](opengd77-progress.md) **Next**:

- Zone-grouping build editor ([#87](https://github.com/pskillen/codeplug-studio/issues/87)) — export uses library zone layout until editor ships
- Multi-mode channel expansion ([#89](https://github.com/pskillen/codeplug-studio/issues/89)) — one export row per channel today
- Export name shortening ([#90](https://github.com/pskillen/codeplug-studio/issues/90)) — long wire names warn but are not truncated
