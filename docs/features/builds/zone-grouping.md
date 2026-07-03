## Purpose

How zones appear on the CPS wire for builds with the **zone grouping** trait. Library `Zone` rows are the source of truth for membership; export order follows library zone order unless a build has a persisted `ZoneGroupingLayout` section (e.g. from YAML import).

**Tracking:** [#87](https://github.com/pskillen/codeplug-studio/issues/87)

**Code:** `src/core/domain/zoneGroupingLayout.ts`, `assemble` zone projection, `/builds/:id/zones` wire preview

## Operator workflow

1. Curate zone membership in **Library → Zones**.
2. Open **Radio builds → Zones** on the build — same wire preview table as other entity pages (include toggle + wire name override).
3. Export from **Export** — `assemble` projects zones from library membership (or build layout when present).

A dedicated build zone layout editor (member reorder per zone) is **deferred** — see [#99](https://github.com/pskillen/codeplug-studio/issues/99).

**DM32 export knobs** (`exportScratchChannel`, `exportScanList`, `scanCarrierFrequencyHz`) persist on `ZoneGroupingLayout` zone entries for DM32 builds ([#104](https://github.com/pskillen/codeplug-studio/issues/104)). Build UI: [#121](https://github.com/pskillen/codeplug-studio/issues/121).

## Related

- [wire-preview.md](wire-preview.md) — override semantics and shared table
- [data-model](../data-model/README.md) — trait layout vs library zones
- [cps-services.md](../import-export/cps-services.md) — `assemble` zone projection
