# BuildZoneExportControls

DM32-only zone export trait controls on `/builds/:id/zones`.

## Purpose

Lets operators configure per-zone DM32 export flags on the build `ZoneGroupingLayout` and per-member scan inclusion on library zones.

## Props

None — reads `build` from `BuildLayoutContext` and library from persistence.

## Behaviour

- Seeds `ZoneGroupingLayout` from library zones when the build has no layout section yet.
- **Export scratch channel** / **Export as scan list** / **Scan carrier MHz** → `buildService.withZoneGroupingSection`.
- **Include in scan list** → `persistence.putZone` (`ZoneMemberEntry.includeInScanList`).

Hidden when `build.formatId !== 'dm32'`.

## Related

- [zone-grouping.md](../../../../docs/features/builds/zone-grouping.md)
- [zone-derived-scan-lists.md](../../../../docs/reference/zone-derived-scan-lists.md)
