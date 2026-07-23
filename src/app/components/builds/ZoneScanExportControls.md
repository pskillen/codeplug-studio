# ZoneScanExportControls

Zone scan export controls for **DM32** and **Anytone** builds — used inside the zone override modal (`ZoneScanOverrideSection`).

## Purpose

Lets operators configure per-zone scan export flags on the build `ZoneGroupingLayout` and per-member scan inclusion on the **exported zone projection** (`scanMemberInclusion`).

## Components

| Export                | Role                                                                                     |
| --------------------- | ---------------------------------------------------------------------------------------- |
| `ZoneScanRowHeader`   | Collapse header: expand chevron, **Export as scan list** switch, member count badge      |
| `ZoneScanExpandPanel` | Expanded panel: recursive **Include in scan list** toggles; carrier MHz (DM32 + Anytone) |

## Props

See `ZoneScanRowHeaderProps` and `ZoneScanExpandPanelProps` in `ZoneScanExportControls.tsx`.

Layout state is provided by [`useZoneScanExportLayout`](../../../hooks/useZoneScanExportLayout.ts) on `BuildZonesWirePage` and passed into `ZoneScanOverrideSection` in the override modal.

## Behaviour

- Syncs `ZoneGroupingLayout` with library zones via `syncZoneGroupingWithLibrary`.
- **Export as scan list** → `buildService.withZoneGroupingSection`.
- **Include in scan list** → `ZoneGroupingZoneEntry.scanMemberInclusion` on the **exported** zone (build-scoped). Nested members listed with `(child zone)` suffix; toggles do not rewrite the child library zone.
- On MxN radios, members **nest under shaded parents** with per-projection toggles (`memberKey` = expansion `key`). Parent skip omits all projections; child skip omits one wire. Cap badge counts use **expanded** membership (#570).
- Carrier MHz when **Export as scan list** is on (DM32 and Anytone).
- Scratch channels use the build **Export → Scratch channels** toggle (`exportSettings.exportScratchChannels`), not this panel.

## Related

- [zone-grouping.md](../../../../docs/features/builds/zone-grouping.md)
- [zone-derived-scan-lists.md](../../../../docs/reference/zone-derived-scan-lists.md)
- [ZoneBehaviourExportOverrides](./ZoneBehaviourExportOverrides.md)
