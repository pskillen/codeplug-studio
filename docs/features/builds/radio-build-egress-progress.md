# RadioBuild + EgressPath — progress

**Tracking:** [#654](https://github.com/pskillen/codeplug-studio/issues/654) · Branch `654/pskil/radio-build-egress` · **Shipped**

## Status

| Slice | Status | Notes |
| --- | --- | --- |
| 1 Model + catalog | Done | `RadioBuild`, `EgressPath`, `src/core/radio-targets/catalog.ts` |
| 2 Persistence + `BuildService` | Done | IndexedDB `radioBuilds` + `egressPaths` (schema v22); native YAML; legacy `formatBuilds` dropped with warning |
| 3 assemble / export / radio-io callers | Done | `exportBuild*` / `assemble` take `{ build, egress, library }`; app services wired to egress |
| 4 UI egress picker + retain pages | Done | Export egress switcher; NeonPlug settings + Radio image scoped to egress hydration |
| 5 Docs | Done | Hub, contributor checklists, DESIGN.md, data-model aligned |

## What shipped

- **`RadioBuild`**: radio-centric config keyed by catalog `radioTargetId` — wire names, slots, inclusions, trait layout. Many builds may share the same target id.
- **`EgressPath`**: child pathways with `formatId` / `profileId`, `kind: cps-file | web-serial`, optional `hydration` (NeonPlug donor / radio-clone retain).
- **Persistence**: IndexedDB `radioBuilds` + `egressPaths` at schema v22; legacy `formatBuilds` store removed without migration.
- **Native YAML**: `radioBuilds[]` + `egressPaths[]`; non-empty legacy `formatBuilds[]` dropped with import warning.
- **Export UI**: egress switcher on `/builds/:id/export`; donor merge and Web Serial read/write hydrate the **active egress**.
- **Create build**: New build flow still uses format → profile picker; profile maps to `radioTargetId` and seeds all compatible egress children.

See [builds hub](README.md) and [data-model](../data-model/README.md) for the canonical product description.

## Next

Initiative complete — hub implementation status and GitHub [#654](https://github.com/pskillen/codeplug-studio/issues/654) are canonical. Retire this log when the branch merges.
