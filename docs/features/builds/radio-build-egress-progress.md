# RadioBuild + EgressPath — progress

**Tracking:** [#654](https://github.com/pskillen/codeplug-studio/issues/654) · Branch `654/pskil/radio-build-egress`

## Status

| Slice | Status | Notes |
| --- | --- | --- |
| 1 Model + catalog | In progress | `RadioBuild`, `EgressPath`, `src/core/radio-targets/` |
| 2 Persistence (IndexedDB/in-memory) + `BuildService` | In progress | `radioBuilds` + `egressPaths` stores; native YAML bridging still pending |
| 3 assemble / export / radio-io | Pending | `assemble`/`exportBuild` already take `egress` per Slice 1; UI callers not yet wired |
| 4 UI egress picker + retain pages | Pending | |
| 5 Docs | Pending | |

## In flight

- Core models and radio-target catalog landed; factories seed egresses per target.
- Persistence port (`src/integrations/persistence/`) now stores `radioBuild` + `egressPath` rows in place of the legacy `formatBuild` store:
  - `types.ts` / `stores.ts`: `EntityKind` has `radioBuild` | `egressPath`; `ProjectSeed.radioBuilds` / `egressPaths`.
  - `indexedDb.ts`: schema upgrade drops the legacy `formatBuilds` object store outright (no build-data migration; library rows untouched) and creates `radioBuilds` + `egressPaths` (with a `byRadioBuild` compound index for `listEgressPathsForBuild`).
  - `inMemory.ts`: mirrors the same CRUD + cascade-delete behaviour for tests/dev.
  - `formatBuildRow.ts` renamed to `radioBuildRow.ts` (`readRadioBuildRow`), still normalising via `migrateFormatBuild.ts` (already `RadioBuild`-typed from Slice 1).
  - `projectSeed.ts` bridges `ProjectAggregate.formatBuilds` ↔ `ProjectSeed.radioBuilds`; `egressPaths` do **not** yet round-trip through native YAML (aggregate has no egress field yet) — tracked in outstanding.
- `src/app/state/buildService.ts` rewritten for `RadioBuild` + `EgressPath`: `createBuild(projectId, radioTargetId, name?)` seeds every compatible egress via `newRadioBuildWithEgresses`; `deleteBuild` cascades egress paths; `withUpdatedProfile` removed (profile now lives on `EgressPath`) and replaced with `withDefaultEgressPathId`; `withCpsWireHydration`/`clearCpsWireHydration` moved to `withEgressHydration`/`clearEgressHydration` on `EgressPath`. Added `listEgressPaths` / `getEgressPath` / `putEgressPath`.
- `src/app/state/useFormatBuilds.ts` kept its file/hook names (`useFormatBuilds`/`useFormatBuild`) to avoid a wide UI import rename this slice, but now reads `RadioBuild[]` via the new persistence methods internally.
- Fixed two other persistence-port consumers broken by the store rename (not in the original file list, but required for the port to compile): `src/app/state/libraryService.ts` (`deleteAllDigitalContacts` build-override pruning) and its test.
- Persistence + `BuildService` unit tests updated and passing (`indexedDb.test.ts`, `inMemory.test.ts`, `buildService.test.ts`, `libraryService.test.ts`).
- Still broken (pre-existing from Slice 1, unaffected by Slice 2, deferred to Slice 3/4): UI components and services reading `build.formatId` / `build.profileId` / `build.cpsWireHydration` directly (`ExportBuildCpsPanel`, `BuildSwitcher`, `buildCpsExportService.ts`, `radioIoSession.ts`, etc.) — these need the egress picker + per-egress export wiring before they compile again.
