# Maidenhead locator conversion

Conversion between Maidenhead grid locators and WGS84 coordinates — shared `core` domain helper used by the [Field tools](field-tools/README.md) (My locator, Distance & bearing, Nearby repeaters), repeater import, and the channel map.

**Tracking:** [#29](https://github.com/pskillen/codeplug-studio/issues/29) · [#490](https://github.com/pskillen/codeplug-studio/issues/490) (Bearing mode) · Phase 2 [#12](https://github.com/pskillen/codeplug-studio/issues/12)

## Implementation status

| Area                            | Status   | Notes                                                                                                                                        |
| ------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Locator tool (`/tools/locator`) | Shipped  | Moved from the old Convert tab — see [field-tools](field-tools/README.md) ([#1497](https://github.com/pskillen/codeplug-studio/issues/1497)) |
| Bearing tool (`/tools/bearing`) | Shipped  | Moved from the old Bearing tab; A/B pins, return bearing ([#1497](https://github.com/pskillen/codeplug-studio/issues/1497))                  |
| `/reference/maidenhead`         | Redirect | Bearing links go to `/tools/bearing`, all others to `/tools/locator`                                                                         |
| Core `maidenhead.ts`            | Shipped  | Locator validation and conversion                                                                                                            |
| Core `geoDistance.ts`           | Shipped  | Haversine distance, initial/reciprocal bearing, path metrics                                                                                 |
| Repeater import seeding         | Shipped  | Locator/lat-lon → channel location                                                                                                           |
| Channel editor location         | Shipped  | `MapLocationPicker`, reconcile on save                                                                                                       |

## Purpose

### Field tools

The old two-mode page at `/reference/maidenhead` (Convert and Bearing tabs) is now **My locator**, **Distance & bearing** and **Nearby repeaters**; see [field-tools/README.md](field-tools/README.md). `/reference/maidenhead` redirects (`?mode=bearing` or `?tab=bearing` to `/tools/bearing`, otherwise `/tools/locator`).

The [band plan](../reference/bands.md) lives at `/reference/bands`.

### Repeater import

When importing from [repeater directories](repeater-directories/README.md), records that carry a Maidenhead locator or lat/lng seed channel `location`, `maidenheadLocator`, and `useLocation`.

### Channel editor

The library channel editor (`/library/channels/:id`) includes a **Location** section with locator input, lat/lon, use-location, and `MapLocationPicker` inside v2 `MapPanel` (click/drag). Save calls `reconcileChannelLocation` — coordinates win when locator and coords conflict in one edit session. No **Use my location** on this page (Field tools and list maps only).

### Channel map

The [map](map/README.md) plots channels that have a stored location. Operator **You** marker appears when **Show my location** is used on library list maps. An optional [Maidenhead grid overlay](map/maidenhead-grid.md) is enabled from Settings ([#45](https://github.com/pskillen/codeplug-studio/issues/45)).

## Code anchors

| Path                                                     | Role                                                                        |
| -------------------------------------------------------- | --------------------------------------------------------------------------- |
| `src/core/domain/maidenhead.ts`                          | `locatorToCoords`, `coordsToLocator`, `isValidLocator` (4–10 char)          |
| `src/core/domain/fieldGeo.ts`                            | Locator square bounds, display casing, covering squares, ranking            |
| `src/core/domain/geoDistance.ts`                         | `haversineDistanceM`, `initialBearingDeg`, `pathMetricsBetween`, formatters |
| `src/core/domain/maidenheadGrid.ts`                      | Grid line/label geometry for map overlay                                    |
| `src/app/routes/tools/`                                  | Field tool pages — [field-tools](field-tools/README.md)                     |
| `src/app/components/MapLocationPicker/`                  | Click/drag map picker (channel editor)                                      |
| `src/integrations/geocode/`                              | Photon + Mapbox geocode client (Photon uses shared session cache)           |
| `src/integrations/preferences/`                          | Mapbox token in `localStorage`                                              |
| `src/app/hooks/useMapSettings.ts`                        | Settings ↔ preferences bridge                                               |
| `src/app/lib/channelLookup.ts`                           | Channel autocomplete helpers                                                |
| `src/app/components/channels/ChannelLocationSection.tsx` | Channel editor location block                                               |
| `src/core/domain/channelLocation.ts`                     | `reconcileChannelLocation` on save                                          |

## Inputs and outputs

| Direction          | Input                                                  | Output                                     |
| ------------------ | ------------------------------------------------------ | ------------------------------------------ |
| Locator → coords   | 4, 6, 8, or 10-character Maidenhead (case-insensitive) | Centre of the finest specified square      |
| Coords → locator   | WGS84 lat/lon + precision                              | Locator at chosen precision                |
| Distance & bearing | Two points (A, B)                                      | Great-circle distance, bearing A→B and B→A |

## Behaviour

- Invalid characters or length → validation message on the converter; `locatorToCoords` returns `null`.
- Southern/western hemispheres: negative lat/lon handled per standard Maidenhead rules.
- Precision: 4 = field; 6 = square (~5 km); 8 = subsquare; 10 = cell.
- Geocode: Photon needs no token; repeated town/postcode lookups within a tab reuse a **sessionStorage** cache (≤5 min) and honour Photon **429** cooldown. Mapbox requires token in Settings → Map.
- Channel picker disabled without an active project; uses UUID `id` refs, not wire names.

## Manual verify

1. Visit `/tools/locator` and enter `IO91WM` in the lookup box → the square outlines near London and the locator reads `IO91wm`.
2. Change the precision chips → locator length updates.
3. With a project active, open a channel → enter `IO91WM` or click the map → save → reload and confirm locator + coordinates persist.
4. See [field-tools](field-tools/README.md) for the bearing and nearby checks.

## Related

- [field-tools](field-tools/README.md) · [reference/](reference/README.md) · [map](map/README.md) · [repeater-directories](repeater-directories/README.md) · [bands reference](../reference/bands.md)
