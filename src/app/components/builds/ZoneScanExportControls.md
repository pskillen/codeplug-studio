# ZoneScanExportControls

Expandable zone scan export controls integrated into the build **Zones** wire preview table.

## Purpose

Lets operators configure per-zone scan export flags on the build `ZoneGroupingLayout` and per-member scan inclusion on library zones — for **DM32** and **Anytone** builds.

## Components

| Export | Role |
| --- | --- |
| `ZoneScanRowHeader` | Collapse header: expand chevron, **Export as scan list** switch, member count badge |
| `ZoneScanExpandPanel` | Expanded panel: per-member **Include in scan list**; DM32-only scratch + carrier MHz |

## Props

See `ZoneScanRowHeaderProps` and `ZoneScanExpandPanelProps` in `ZoneScanExportControls.tsx`.

Layout state is provided by [`useZoneScanExportLayout`](../../../hooks/useZoneScanExportLayout.ts) on `BuildZonesWirePage`.

## Behaviour

- Syncs `ZoneGroupingLayout` with library zones via `syncZoneGroupingWithLibrary`.
- **Export as scan list** → `buildService.withZoneGroupingSection`.
- **Include in scan list** → `persistence.putZone` (`ZoneMemberEntry.includeInScanList`).
- DM32: carrier MHz and scratch flags in expanded panel only.
- Anytone: scan list + member toggles only (no carrier).

## Related

- [zone-grouping.md](../../../../docs/features/builds/zone-grouping.md)
- [zone-derived-scan-lists.md](../../../../docs/reference/zone-derived-scan-lists.md)
