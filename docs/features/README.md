# Feature documentation

Contributor-oriented docs for features in Codeplug Studio. User-facing overview stays in the [repository README](../../README.md) and [DESIGN.md](../../DESIGN.md).

Agent skills for documentation and execution tracking:

- [feature-docs](../../.cursor/skills/feature-docs/SKILL.md)
- [progress-tracking](../../.cursor/skills/progress-tracking/SKILL.md)

**Tier boundaries:** [`.cursor/rules/documentation-boundaries.mdc`](../../.cursor/rules/documentation-boundaries.mdc) — tier 1 here; domain reference in `docs/reference/`; wire tables per format under `docs/reference/<format>/`.

**Migration / epic logs:** [docs/poc-migration/](../poc-migration/) — execution progress for Epic #1.

## Features

| Topic                | Source                                                                               | Docs                                                                                                                                        | Status                                                                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data model           | `src/core/models/`, `src/core/domain/`                                               | [data-model/](data-model/)                                                                                                                  | Phase 1 — project, library, format build, traits                                                                                                                                   |
| App shell            | `src/app/routes/`, `src/app/components/`                                             | [app-shell/](app-shell/)                                                                                                                    | Phase 2 — navigation, route surfaces, project lifecycle                                                                                                                            |
| Debug                | `src/integrations/debug/`, `src/app/routes/debug/`                                   | [debug/](debug/)                                                                                                                            | Phase 3 ([#54](https://github.com/pskillen/codeplug-studio/issues/54)) — storage inspectors                                                                                        |
| Library CRUD         | `src/app/features/library/`, `src/integrations/persistence/`                         | [library/](library/)                                                                                                                        | Phase 2 — channel/talk-group/contact CRUD + IndexedDB                                                                                                                              |
| Map                  | `src/app/components/CodeplugMap/`, `src/core/domain/mapProjection.ts`                | [map/](map/) ([progress](map/map-embed-progress.md))                                                                                        | Phase 2 ([#22](https://github.com/pskillen/codeplug-studio/issues/22))                                                                                                             |
| Repeater directories | `src/integrations/repeaters/`                                                        | [repeater-directories/](repeater-directories/)                                                                                              | Phase 2 — UK repeater + BrandMeister library workflows                                                                                                                             |
| Summary              | `src/app/routes/SummaryPage.tsx`, `src/core/domain/summary.ts`                       | [report/](report/)                                                                                                                          | Phase 2 ([#12](https://github.com/pskillen/codeplug-studio/issues/12))                                                                                                             |
| Maidenhead           | `src/core/domain/maidenhead.ts`, `src/app/routes/reference/`                         | [maidenhead.md](maidenhead.md), [reference/](reference/)                                                                                    | [#29](https://github.com/pskillen/codeplug-studio/issues/29) — `/reference/maidenhead`                                                                                             |
| Reference / bands    | `src/core/domain/bandCatalog.ts`, `src/app/routes/reference/`                        | [reference/](reference/), [bands.md](../reference/bands.md)                                                                                 | [#30](https://github.com/pskillen/codeplug-studio/issues/30) — `/reference/bands`                                                                                                  |
| Import / export      | `src/core/import-export/`, `src/core/services/`, `src/app/components/import-export/` | [import-export/](import-export/) ([progress](import-export/native-yaml-progress.md), [operator lifecycle](workflows/operator-lifecycle.md)) | Phase 3 ([#56](https://github.com/pskillen/codeplug-studio/issues/56)–[#60](https://github.com/pskillen/codeplug-studio/issues/60)) — native YAML services + local file UI shipped |
| _(later phases)_     | `src/app/features/builds/`                                                           | `builds/`                                                                                                                                   | Planned — build UI beyond library CRUD                                                                                                                                             |

## Reference

Domain-neutral amateur-radio facts (tier 2) and per-format CPS wire tables (tier 3). Full tree ported from the [codeplug-tool](https://github.com/pskillen/codeplug-tool) archive; import/export adapters ship in later phases.

| Topic                         | Docs                                                                                                                                                |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| UK bands and receive services | [reference/bands.md](../reference/bands.md)                                                                                                         |
| Channel modes                 | [reference/channel-modes.md](../reference/channel-modes.md)                                                                                         |
| Display conventions           | [reference/display-conventions.md](../reference/display-conventions.md)                                                                             |
| Callsigns                     | [reference/callsigns.md](../reference/callsigns.md)                                                                                                 |
| Multi-talkgroup expansion     | [reference/multi-talkgroup-expansion.md](../reference/multi-talkgroup-expansion.md)                                                                 |
| UK Repeater API               | [reference/ukrepeater/](../reference/ukrepeater/README.md)                                                                                          |
| OpenGD77 CPS CSV              | [reference/opengd77/](../reference/opengd77/README.md) — generic wire format + per-radio [variant profiles](../reference/opengd77/radios/README.md) |
| CHIRP CSV (analogue FM/AM)    | [reference/chirp/](../reference/chirp/README.md)                                                                                                    |
| DM32 CSV                      | [reference/dm32/](../reference/dm32/README.md)                                                                                                      |

Add a row when a new feature folder ships. Reference trees are **per format** (OpenGD77, DM32, CHIRP, …); OpenGD77 is the first documented, not the internal model default.
