## Purpose

How zones appear on the CPS wire for builds with the **zone grouping** trait. **Library `Zone.members` is the source of truth for channel↔zone linkage** (export inclusion, assemble, wire-preview hide). A persisted `ZoneGroupingLayout` on the build supplies **member order hints** and DM32-only export flags — layout `channelIds` do **not** define which channels belong to a zone.

**Tracking:** [#87](https://github.com/pskillen/codeplug-studio/issues/87)

**Code:** `src/core/domain/zoneGroupingLayout.ts`, `assemble` zone projection, `/builds/:id/zones` wire preview

## Operator workflow

1. Curate zone membership and **top-level zone export order** in **Library → Zones** (`Zone.order` via Move up/down or Sort…). Nested zones and optional **Don't export as its own zone** — see [nested-zones.md](../library/nested-zones.md).
2. Open **Export for radio → Zones** on the build — wire preview table (include toggle + wire name override + **reorder column** for `zoneOverrides.orderOrSlot`). The list is sorted by the same export-order rules as `assemble`, so up/down moves rows in place. Zones with a custom **member** export order (layout `channelIds` hint) show a **Custom member order** badge; when top-level zone list `orderOrSlot` is overridden, a yellow banner offers **Reset to library order** (confirm). Open a row for the override modal (**Export** / **Members** / optional **Scan** tabs): wire name and skip/force on Export; **member export order** on Members (layout `channelIds` hint — drag, selection Move, and per-row arrows; same banner when hint ≠ library membership order); scan options on Scan when the build has zone-derived scan (`ZoneGrouping` + `ScanLists` or `DedicatedScanLists`).
3. For **DM32** / **Anytone** builds with scan export on, the expanded zone panel includes **Scan carrier frequency** — MHz simplex for the `{zoneName} Scan` carrier channel (default 145.500).
4. Optionally set library **Zone defaults** (`/library/zones/defaults`) and per-member tri-state overrides on the zone editor.
5. Enable **Export zone-derived scan lists** on the build **Export** page when you want zone flags to emit scan lists (DM32 `Scan.csv`, Anytone `ScanList.CSV` alongside library scan lists). Optional build-wide membership default override lives there too.
6. **Scratch channels** (DM32 and Anytone) are a build Export → Channels toggle (`exportSettings.exportScratchChannels`), not a per-zone flag — see [dm32/export-projections.md](../import-export/dm32/export-projections.md).
7. Audit winning layers on **Export resolution → Zones**.
8. Export from **Export** — `assemble` sorts zones by build `orderOrSlot` → `Zone.order` → name; derives `memberChannelIds` from library membership via `resolveEffectiveZoneChannelIds` (nested zones flattened). Layout `channelIds` reorder ids that appear in both lists; new effective ids append at the end.

**DM32 / Anytone zone layout knobs** (`exportScanList`, `scanCarrierFrequencyHz`) persist on `ZoneGroupingLayout` zone entries. Legacy `exportScratchChannel` on zone entries is ignored (scratch moved to build export settings in [#140](https://github.com/pskillen/codeplug-studio/issues/140)). Per-member scan inclusion is vendor-neutral on library `Zone.members` / layout projection.

**Tracking:** [#456](https://github.com/pskillen/codeplug-studio/issues/456) (ordering) · [#87](https://github.com/pskillen/codeplug-studio/issues/87)

## Related

- [wire-preview.md](wire-preview.md) — override semantics and shared table
- [wire-name-composition.md](wire-name-composition.md) — zone linkage vs wire naming
- [data-model](../data-model/README.md) — trait layout vs library zones
- [cps-services.md](../import-export/cps-services.md) — `assemble` zone projection
