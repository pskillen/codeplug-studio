# RadioBuild + EgressPath — outstanding

**Tracking:** [#654](https://github.com/pskillen/codeplug-studio/issues/654) · **Shipped**

Items discovered during execution (not the plan checklist).

## Open

_(none)_

## Resolved

- [x] Native YAML (`ProjectAggregate` / `StudioProjectDocument`) now models `radioBuilds: RadioBuild[]` and `egressPaths: EgressPath[]` (no more `formatBuilds`). `validate.ts` parses/emits both arrays; legacy documents with a non-empty `formatBuilds[]` are ignored with a single import warning (`radioBuilds`/`egressPaths` come back empty, library is retained) rather than migrated. `EgressPath.hydration` (CPS wire retain) round-trips through YAML.
- [x] `src/core/domain/references.ts` `EntityReference.fromKind` no longer includes the dead `'formatBuild'` union member.
- [x] `isDm32Build` checks `radioTargetFor(…).compatibleEgress.some(e => e.formatId === 'dm32')` so DM32 zone-field migration still runs when NeonPlug is the catalog default egress for `baofeng-dm32uv`.
- [x] App UI and services use egress-scoped `formatId` / `profileId` / `hydration` — Export egress switcher, `BuildRadioIoPanel`, NeonPlug donor merge, and retain summary routes.
- [x] Contributor checklists updated: [adding-a-radio-adapter.md](../radio-read-write/adding-a-radio-adapter.md), [adding-a-new-format.md](../import-export/adding-a-new-format.md), [DESIGN.md](../../../DESIGN.md), [data-model](../data-model/README.md).
