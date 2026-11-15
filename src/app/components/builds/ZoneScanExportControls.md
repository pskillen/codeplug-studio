# ZoneScanExportControls

Zone scan controls for **DM32** and **Anytone** builds (zone-derived scan lists) and for **zone scan set** builds (MM9PDY RT95 and UV-5R Mini, **Scan in this zone**) — used inside the zone override modal (`ZoneScanOverrideSection`).

## Purpose

Lets operators configure per-zone scan export flags on the build `ZoneGroupingLayout` and per-member scan inclusion on the **exported zone projection** (`scanMemberInclusion`).

## Components

| Export                | Role                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `ZoneScanRowHeader`   | Collapse header: expand chevron, **Export as scan list** switch, member count badge                                 |
| `ZoneScanExpandPanel` | Expanded panel: recursive **Include in scan list** (or **Scan in this zone**) toggles; carrier MHz (DM32 + Anytone) |

## Props

See `ZoneScanRowHeaderProps` and `ZoneScanExpandPanelProps` in `ZoneScanExportControls.tsx`.

| Prop (`ZoneScanExpandPanel`, `ZoneScanOverrideSection`) | Type                      | Default      | Meaning                                                                                                                                                         |
| ------------------------------------------------------- | ------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `variant`                                               | `'scanList' \| 'scanSet'` | `'scanList'` | `scanSet`: heading and switch labels say **Scan in this zone**; the section drops **Export as scan list**, the carrier and the cap, and warns below two members |

Layout state is provided by [`useZoneScanExportLayout`](../../../hooks/useZoneScanExportLayout.ts) on `BuildZonesWirePage` and passed into `ZoneScanOverrideSection` in the override modal.

## Behaviour

- Syncs `ZoneGroupingLayout` with library zones via `syncZoneGroupingWithLibrary`.
- **Export as scan list** → `buildService.withZoneGroupingSection`.
- **Include in scan list** → `ZoneGroupingZoneEntry.scanMemberInclusion` on the **exported** zone (build-scoped). Nested members listed with `(child zone)` suffix; toggles do not rewrite the child library zone.
- On MxN radios, members **nest under shaded parents** with per-projection toggles (`memberKey` = expansion `key`). Parent skip omits all projections; child skip omits one wire. Cap badge counts use **expanded** membership (#570).
- Carrier MHz when **Export as scan list** is on (DM32 and Anytone).
- **Scan set variant** (`ZoneScanSet` builds): the same per-member toggles write the same `scanMemberInclusion` projection, read as the zone's scan set. The section badge counts members set to Scan in this zone and turns orange below two, when the zone won't scan on the radio. See [zone-scan-sets.md](../../../../docs/features/builds/zone-scan-sets.md).
- Scratch channels use the build **Export → Scratch channels** toggle (`exportSettings.exportScratchChannels`), not this panel.

## Related

- [zone-grouping.md](../../../../docs/features/builds/zone-grouping.md)
- [zone-derived-scan-lists.md](../../../../docs/reference/zone-derived-scan-lists.md)
- [zone-scan-sets.md](../../../../docs/features/builds/zone-scan-sets.md)
- [ZoneBehaviourExportOverrides](./ZoneBehaviourExportOverrides.md)
