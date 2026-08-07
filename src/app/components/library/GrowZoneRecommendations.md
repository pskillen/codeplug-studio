# GrowZoneRecommendations

Contributor sidecar for `GrowZoneRecommendations.tsx` — add-from-map grow workflow on the zone edit shell.

## Purpose

Recommends library channels to append to an existing zone using geography:

- **Inside hull** — non-members with coordinates inside the zone’s map hull.
- **Near locator** — non-members ranked by distance from a reference point (default zone centre).

Operator multi-selects suggestions in a v2 `DataTable` and adds them to the shell draft via **Add selected to zone** (`addChannelsToZoneMembers`).

## Props

None — reads `useZoneEdit()` from `ZoneEditContext` (must render under `ZoneEditLayout`).

## Usage

```tsx
// ZoneEditAddFromMapPage.tsx
export default function ZoneEditAddFromMapPage() {
  return <GrowZoneRecommendations />;
}
```

## Behaviour

- **Chrome (mk2 M3, [#943](https://github.com/pskillen/codeplug-studio/issues/943)):** `EditorHeader`, mode `SegmentedControl`, v2 `DataTable` with **Nearest member** column, multi-select + bulk add, optional map `Panel` below.
- Computes member geolocated points via `resolveZoneMemberGeolocatedPoints`.
- Excludes effective zone members (`resolveEffectiveZoneChannelIds`).
- **Near locator:** `GeocodeCentreField` (`Combobox` geocode) plus Maidenhead, **Use my location**, channel pick, map click, reset to zone centre.
- Map dims channels that are neither members nor current suggestions; shows reference pin when locator set.
- Membership changes stay in the edit shell draft until **Save** on any sub-screen.

## Related

- [zone-member-picker.md](../../../docs/features/library/zone-member-picker.md) · [map/zones.md](../../../docs/features/map/zones.md)
- Core: `src/core/domain/growZone.ts`
- Geocode UI: `GeocodeCentreField.tsx`
