# RadioBuild + EgressPath — outstanding

**Tracking:** [#654](https://github.com/pskillen/codeplug-studio/issues/654)

Items discovered during execution (not the plan checklist).

## Open

- [ ] Native YAML (`ProjectAggregate` / `StudioProjectDocument`) still models a single `formatBuilds: FormatBuild[]` array and has no `egressPaths` field. `projectSeed.ts`'s `seedFromAggregate`/`aggregateFromSeed` bridge `aggregate.formatBuilds` ↔ `seed.radioBuilds`, but egress rows do not round-trip through YAML export/import yet (empty on import; dropped on export). Needs a Slice 3/4 decision on how `EgressPath` (formatId/profileId/hydration) is represented in the YAML envelope. — [#654](https://github.com/pskillen/codeplug-studio/issues/654)
- [ ] `src/core/domain/references.ts` `EntityReference.fromKind` still includes the literal `'formatBuild'` (never produced by `findReferencesTo`; dead union member, not wired to the persistence `EntityKind`). Harmless today but should be cleaned up when references/integrity checks are revisited for radio builds. — [#654](https://github.com/pskillen/codeplug-studio/issues/654)
