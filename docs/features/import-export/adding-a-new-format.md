# Adding a new CPS import/export format

> **Status:** Staging notes — not the canonical guide yet.
>
> **Tracking:** [#183 — docs: canonical guide for adding a new CPS import/export format](https://github.com/pskillen/codeplug-studio/issues/183)
>
> This file exists so work on other tickets can capture contributor-facing thoughts before #183 rewrites the full checklist (migrated from [codeplug-tool `adding-a-new-vendor.md`](https://github.com/pskillen/codeplug-tool/blob/main/docs/features/import-export/adding-a-new-vendor.md) with Studio-specific paths). **Do not treat this as complete documentation** — merge, expand, and replace when executing #183.

---

## Notes from [#157](https://github.com/pskillen/codeplug-studio/issues/157) nested zones / export extension

Captured during nested-zone export work (Glasgow ⊃ PMR446 scenario). Relevant when a new format adapter must emit **zones** and **channels**.

### Export pipeline — where format adapters sit

```text
library + FormatBuild
  → assemble(build, library)     # core — vendor-neutral projection
  → AssembledBuild               # flat channel ids per zone; wire names not final
  → format serialise.ts          # CPS columns, expansion, profile caps, warnings
  → ZIP / CSV download
```

**Rule for new formats:** serialisers consume `AssembledBuild.zones[].memberChannelIds` (UUIDs). They **must not** walk library `Zone.members` or re-flatten nested zones — that belongs in `assemble` via `resolveEffectiveZoneChannelIds`.

If the format needs extra derived artefacts (DM32 zone-derived `Scan.csv`), add a **derive** step between assemble and serialise (see `src/core/import-export/zoneDerivedScanLists/derive.ts`) rather than pushing hierarchy logic into the adapter.

### Library vs build vs format — three layers of “export this zone”

| Concern                                          | Layer                                       | Example                                                                                                        |
| ------------------------------------------------ | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Zone membership (channels + nested zones)        | Library `Zone.members`                      | `kind: 'channel'` / `kind: 'zone'`                                                                             |
| Omit standalone zone row (nested building block) | Library `Zone.omitFromExport`               | PMR446 simplex set included only inside city zones                                                             |
| Per-build wire name / include toggle             | `FormatBuild.zoneOverrides`                 | `excluded`, `wireName`                                                                                         |
| Per-build member order + format-only flags       | `ZoneGroupingLayout` on build               | DM32 `exportScanList`, `scanCarrierFrequencyHz`; `channelIds` = **order hint**, not membership source of truth |
| Per-member scan inclusion (vendor-neutral)       | Library `ZoneMemberEntry.includeInScanList` | Honoured by DM32 scan derivation                                                                               |

**Pitfall (shipped bug):** when a build has a persisted `zoneGrouping` section, `assembleZones` must still derive `memberChannelIds` from the **live library** (effective flatten), not from stale `ZoneGroupingLayout.channelIds`. New format contributors should assume assembled zone membership is already flat.

### What to implement per format for zones

1. **`serialiseZones(assembled, …)`** — map `memberChannelIds` → wire names (profile limits, truncation warnings).
2. **Channel expansion** — if the format fans out multi-mode / multi-TG rows (OpenGD77 `listWire.ts`, DM32 `channelExpansion.ts`), zone member lists use the **expanded wire names**, not raw channel ids.
3. **Cardinality warnings** — profile max channels per zone at serialise boundary only (e.g. OpenGD77 ~80 columns); library CRUD stays uncapped.
4. **Tests** — per-direction mapping test: fixture library with nested zones → `assemble` → `serialiseZones` → assert `Zones.csv` row for parent contains child channels; assert `omitFromExport` child has no row when flagged.

### Vendor-neutral core checklist (zones slice)

When adding zone support to a new format adapter, verify in **core** first (not in `formats/<vendor>/`):

- [ ] `assemble` produces correct `memberChannelIds` for nested library zones (with and without `zoneGrouping` layout on build).
- [ ] `zoneLinkedChannelIds` includes effective channels (for `exportUnlinkedChannels` behaviour).
- [ ] Library-only flags (`omitFromExport`, `includeInScanList`) honoured in assemble / derive, not reimplemented in serialise.

### OpenGD77 vs DM32 reference paths (current repo)

| Step            | OpenGD77                                                 | DM32                                                                 |
| --------------- | -------------------------------------------------------- | -------------------------------------------------------------------- |
| Zone wire names | `formats/opengd77/listWire.ts` → `zoneExportMemberNames` | `formats/dm32/channelExpansion.ts` → `expandDm32ZoneMemberWireNames` |
| Zones.csv shape | `Channel1`…`ChannelN` columns                            | Pipe-separated `Members` column                                      |
| Extra derive    | —                                                        | `zoneDerivedScanLists/derive.ts` (optional `Scan.csv`)               |

### Loss documentation

New formats should document in `docs/reference/<format>/`:

- Zones are **flat channel lists** on the wire — nesting is Studio-only; export denormalises.
- Whether standalone zone rows can be omitted (`omitFromExport`) is a Studio export rule, not a CPS import concept.

### Cross-links for #183 author

- [cps-services.md](cps-services.md) — `assemble`, `exportBuild`
- [DESIGN.md](../../../DESIGN.md) — library + builds, vendor boundaries
- [.cursor/rules/export-from-model.mdc](../../../.cursor/rules/export-from-model.mdc) — no wire stash on export
- [docs/build/testing/mapping-tests.md](../../build/testing/mapping-tests.md) — per-direction tests
- [nested-zones.md](../library/nested-zones.md) — hierarchy semantics (tier 1)

---

## Placeholder — full #183 outline

The canonical guide should cover (from [#183](https://github.com/pskillen/codeplug-studio/issues/183)):

- When to add a format vs a radio profile on an existing format
- Reference docs under `docs/reference/<format>/`
- Code layout: `src/core/import-export/formats/<format>/`, `formatCatalog`, adapter contracts
- Import → library; export → `assemble` + serialise
- Expandable channels / mode profiles
- Tests and fixtures
- UI: `FormatCatalogPanel`, build export flow
- Worked examples: OpenGD77, DM32, CHIRP (planned)

Replace this section when executing #183.
