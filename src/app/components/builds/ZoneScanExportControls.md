# ZoneScanExportControls

Expandable zone scan export controls integrated into the build **Zones** wire preview table.

## Purpose

Lets operators configure per-zone scan export flags on the build `ZoneGroupingLayout` and per-member scan inclusion on library zones — for **DM32** and **Anytone** builds.

## Components

| Export                | Role                                                                                                        |
| --------------------- | ----------------------------------------------------------------------------------------------------------- |
| `ZoneScanRowHeader`   | Collapse header: expand chevron, **Export as scan list** switch, member count badge                         |
| `ZoneScanExpandPanel` | Expanded panel: recursive **Include in scan list** toggles; carrier MHz (DM32 + Anytone); DM32-only scratch |

## Props

See `ZoneScanRowHeaderProps` and `ZoneScanExpandPanelProps` in `ZoneScanExportControls.tsx`.

Layout state is provided by [`useZoneScanExportLayout`](../../../hooks/useZoneScanExportLayout.ts) on `BuildZonesWirePage`.

## Behaviour

- Syncs `ZoneGroupingLayout` with library zones via `syncZoneGroupingWithLibrary`.
- **Export as scan list** → `buildService.withZoneGroupingSection`.
- **Include in scan list** → `persistence.putZone` on the **owning** library zone (`ZoneMemberEntry.includeInScanList`); nested zone members are listed with `(child zone)` suffix.
- Carrier MHz when **Export as scan list** is on (DM32 and Anytone).
- DM32-only: scratch channel flag in expanded panel.

## Related

- [zone-grouping.md](../../../../docs/features/builds/zone-grouping.md)
- [zone-derived-scan-lists.md](../../../../docs/reference/zone-derived-scan-lists.md)
