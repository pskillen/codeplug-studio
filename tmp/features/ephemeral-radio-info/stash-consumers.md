# RadioCloneHydration consumer inventory

Phase 01 deletion map for the ephemeral-radio-info series ([#874](https://github.com/pskillen/codeplug-studio/issues/874)).  
Disposition keys: **strip** (remove from project persistence), **rehome** (move to ephemeral Radio Info UI), **in-session** (keep only for the active Web Serial write session until that radio’s drop-stash phase), **leave** (NeonPlug donor retain — unrelated to radio-clone stash).

## App — egress hydration accessors

| Location | Symbol / use | Disposition |
| --- | --- | --- |
| `src/app/services/radioIoSession.ts` | `egressHasRadioCloneHydration`, `buildHasRadioCloneHydration`, `getRadioCloneHydration` | **in-session** — gate write until drop-stash; strip persisted bag (phase 01) |
| `src/app/services/radioIoSession.ts` | `readRadioHydrationForBuild` | **in-session** — Read stores bag on egress today; becomes in-session only (phases 02–12) |
| `src/app/services/radioIoSession.ts` | `prepareRadioWriteImage`, `writeBuildToRadio`, `uploadPreparedRadioWrite` | **in-session** — require bag while `hydrationRequiredForWrite`; drop-stash phases assemble without persisted bag |
| `src/app/services/radioIoSession.ts` | `mergeChannelsIntoHydrationForBuild` | **in-session** — descriptor hook during write prep |
| `src/app/components/builds/BuildRadioIoPanel.tsx` | Read / Write / Clear stored image; `hasHydration` gate | **rehome** inspect summary to Radio Info (phase 03); write stays here |
| `src/app/routes/builds/BuildRadioImageSettingsPage.tsx` | Reads `egress.hydration` bag for clone summary UI | **rehome** → Radio Info route (phase 03) |
| `src/app/lib/buildEgressUi.ts` | `findRadioCloneEgress` | **rehome** → Radio Info (phase 03) |
| `src/app/state/buildService.ts` | `withEgressHydration`, `clearEgressHydration` | **strip** persisted path (phase 01); in-session attach until drop-stash |

## Core / export (NeonPlug only — not radio-clone)

| Location | Symbol / use | Disposition |
| --- | --- | --- |
| `src/core/services/exportBuild.ts` | `isNeonplugDonorBag(egress.hydration)` | **leave** — NeonPlug donor retain |
| `src/app/components/builds/ExportBuildCpsPanel.tsx` | NeonPlug donor bag for export | **leave** |
| `src/app/routes/builds/BuildNeonplugSettingsPage.tsx` | NeonPlug donor retain UI | **leave** |
| `src/app/lib/buildEgressUi.ts` | `findNeonplugDonorEgress` | **leave** |

## Integrations — radio-io descriptors & hydration helpers

| Location | Symbol / use | Disposition |
| --- | --- | --- |
| `src/integrations/radio-io/types.ts` | `RadioHydrationHooks.mergeChannelsIntoHydration`, `extractHydration`, `seedProtocolForUpload` | **in-session** — per-radio drop-stash phases 02–11 |
| `src/integrations/radio-io/radios/*/descriptor.ts` (7 radios) | `hydrationRequiredForWrite: true`, hydration hooks | **in-session** — cleared per radio when drop-stash lands; type removed phase 12 |
| `src/integrations/radio-io/radios/*/hydration.ts` | Bag extract / merge / memory map | **in-session** |
| `src/integrations/radio-io/radios/*/cloneSummary.ts` | Decode bag for operator summary | **rehome** → Radio Info (phase 03) |

## Persistence & import/export boundary

| Location | Symbol / use | Disposition |
| --- | --- | --- |
| `src/integrations/persistence/egressPathRow.ts` | `readEgressPathRow` strips `radio-clone` on load/save | **strip** (phase 01) |
| `src/core/import-export/formats/native-yaml/validate.ts` | Parses `record.hydration` on YAML import | **strip** at persistence boundary after import (phase 01 via egress row read) |
| `src/core/models/radioCloneHydration.ts` | Bag type + guards | **in-session** until phase 12 type cleanup |

## Tests & docs (reference only)

| Location | Disposition |
| --- | --- |
| `src/app/services/radioIoSession.test.ts`, `radioIo*Write.test.ts`, adapter tests | Update per drop-stash phase — no strip in phase 01 |
| `src/app/components/builds/BuildRadioIoPanel.test.tsx` | Warning when `hydrationRequiredForWrite` (phase 01) |
