## Purpose

How zones appear on the CPS wire for builds with the **zone grouping** trait. **Library `Zone.members` is the source of truth for channel↔zone linkage** (export inclusion, assemble, wire-preview hide). A persisted `ZoneGroupingLayout` on the build supplies **member order hints** and DM32-only export flags — layout `channelIds` do **not** define which channels belong to a zone.

**Tracking:** [#87](https://github.com/pskillen/codeplug-studio/issues/87)

**Code:** `src/core/domain/zoneGroupingLayout.ts`, `assemble` zone projection, `/builds/:id/zones` wire preview

## Operator workflow

1. Curate zone membership in **Library → Zones** (including nested zones and optional **Don't export as its own zone** — see [nested-zones.md](../library/nested-zones.md)).
2. Open **Radio builds → Zones** on the build — wire preview table (include toggle + wire name override). **DM32 and Anytone:** expand each zone row for scan export controls — **Export as scan list** and member counts stay visible in the row header; per-member **Include in scan list** toggles live in the expanded panel. **Anytone:** airband-only zones appear on **Airband**; dual-mode zones appear on both **Zones** and **Airband**.
3. For **DM32** builds, the expanded zone panel also includes:
   - **Export scratch channel** — per-zone flag on `ZoneGroupingLayout` (serialisation deferred; UI persists the preference).
   - **Scan carrier frequency** — MHz simplex for the `{zoneName} Scan` carrier channel (default 145.500).
4. Enable **Export zone-derived scan lists** on the build **Export** page when you want zone flags to emit scan lists (DM32 `Scan.csv`, Anytone `ScanList.CSV` alongside library scan lists).
5. Export from **Export** — `assemble` derives `memberChannelIds` from library membership via `resolveEffectiveZoneChannelIds` (nested zones flattened). Layout `channelIds` reorder ids that appear in both lists; new effective ids append at the end.

A dedicated build zone layout editor (member reorder per zone) is **deferred** — see [#99](https://github.com/pskillen/codeplug-studio/issues/99).

**DM32 export knobs** (`exportScratchChannel`, `exportScanList`, `scanCarrierFrequencyHz`) persist on `ZoneGroupingLayout` zone entries ([#104](https://github.com/pskillen/codeplug-studio/issues/104)). Per-member scan inclusion is vendor-neutral on library `Zone.members`.

## Related

- [wire-preview.md](wire-preview.md) — override semantics and shared table
- [wire-name-composition.md](wire-name-composition.md) — zone linkage vs wire naming
- [data-model](../data-model/README.md) — trait layout vs library zones
- [cps-services.md](../import-export/cps-services.md) — `assemble` zone projection
