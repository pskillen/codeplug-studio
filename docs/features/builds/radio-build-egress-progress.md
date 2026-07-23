# RadioBuild + EgressPath — progress

**Tracking:** [#654](https://github.com/pskillen/codeplug-studio/issues/654) · Branch `654/pskil/radio-build-egress` · PR [#657](https://github.com/pskillen/codeplug-studio/pull/657)

## Status

| Slice                                  | Status     | Notes                                                                                                         |
| -------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------- |
| 1 Model + catalog                      | Done       | `RadioBuild`, `EgressPath`, `src/core/radio-targets/catalog.ts`                                               |
| 2 Persistence + `BuildService`         | Done       | IndexedDB `radioBuilds` + `egressPaths` (schema v22); native YAML; legacy `formatBuilds` dropped with warning |
| 3 assemble / export / radio-io callers | Done       | `exportBuild*` / `assemble` take `{ build, egress, library }`; app services wired to egress                   |
| 4 UI (first pass)                      | Incomplete | Export switcher + retain hydration landed; **create/list still CPS-shaped**                                   |
| 4b UI redo                             | Done       | Radio-target New Build; radio-first list; active-egress retain nav; sticky `defaultEgressPathId`              |
| 5 Docs                                 | Done       | Hubs + contributor checklists; UI redo docs follow-up                                                         |

## What shipped

- **`RadioBuild`**: radio-centric config keyed by catalog `radioTargetId` — wire names, slots, inclusions, trait layout. Many builds may share the same target id.
- **`EgressPath`**: child pathways with `formatId` / `profileId`, `kind: cps-file | web-serial`, optional `hydration`.
- **Create**: `/builds/new` picks a **radio target** (grouped by manufacturer), then names the build; compatible egress labels shown as secondary info.
- **List**: empty states and grouping speak radios (List / By radio only — no By format).
- **Export**: egress switcher; switching persists `defaultEgressPathId`; NeonPlug settings / Radio image nav only while that pathway is **active**.

See [builds hub](README.md) and [data-model](../data-model/README.md).

## Next

Retire this log when PR #657 merges.
