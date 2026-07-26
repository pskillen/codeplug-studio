# Maidenhead locator conversion

Conversion between Maidenhead grid locators and WGS84 coordinates — shared `core` domain helper used by the Maidenhead reference tool, repeater import, and the channel map.

**Tracking:** [#29](https://github.com/pskillen/codeplug-studio/issues/29) · [#490](https://github.com/pskillen/codeplug-studio/issues/490) (Bearing mode) · Phase 2 [#12](https://github.com/pskillen/codeplug-studio/issues/12)

## Implementation status

| Area                                   | Status  | Notes                                                                                                                 |
| -------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------- |
| Convert mode (`/reference/maidenhead`) | Shipped | Locator ↔ coordinates, map, geocode, channel seed                                                                     |
| Bearing mode                           | Shipped | From/To distance and bearing, dual map, hero metrics ([#490](https://github.com/pskillen/codeplug-studio/issues/490)) |
| Core `maidenhead.ts`                   | Shipped | Locator validation and conversion                                                                                     |
| Core `geoDistance.ts`                  | Shipped | Haversine distance, initial/reciprocal bearing, path metrics                                                          |
| Repeater import seeding                | Shipped | Locator/lat-lon → channel location                                                                                    |
| Channel editor location                | Shipped | `MapLocationPicker`, reconcile on save                                                                                |

## Purpose

### Reference tool (`/reference/maidenhead`)

Two modes on one page — **Convert** and **Bearing**.

**Convert** — locator ↔ coordinates ad hoc without an active project:

- Locator ↔ coordinates at selectable precision (4 / 6 / 8 / 10 characters)
- Map click and drag marker (`MapLocationPicker`)
- Device geolocation via **Use my location**
- Address geocode (Photon by default; Mapbox when a token is set in Settings)
- Channel lookup when a project is active (seeds from channel `location`)

**Bearing** — distance and bearing between two points (mobile-first, outdoor workflow):

- **From** and **To** locator fields; **Use my location** on **From** for your current position
- Hero shows bearing From → To (degrees true + compass octant) and distance (km and miles)
- **Details** table: coordinates, reciprocal bearing, Δ lat/lon
- `MapPairPlot`: both points, dashed path, fit bounds; **Set on map: From | To** near the map
- Address and channel look-up under **More ways to set** (accordion)
- Metrics use the **centre** of each locator square; coarser grids imply larger positional uncertainty

The [band plan](../reference/bands.md) lives at `/reference/bands`.

### Repeater import

When importing from [repeater directories](repeater-directories/README.md), records that carry a Maidenhead locator or lat/lng seed channel `location`, `maidenheadLocator`, and `useLocation`.

### Channel editor

The library channel editor (`/library/channels/:id`) includes a **Location** section with locator input, lat/lon, use-location, and `MapLocationPicker` (click/drag). Save calls `reconcileChannelLocation` — coordinates win when locator and coords conflict in one edit session. No **Use my location** on this page (reference tool and list maps only).

### Channel map

The [map](map/README.md) plots channels that have a stored location. Operator **You** marker appears when **Show my location** is used on library list maps. An optional [Maidenhead grid overlay](map/maidenhead-grid.md) is enabled from Settings ([#45](https://github.com/pskillen/codeplug-studio/issues/45)).

## Code anchors

| Path                                                     | Role                                                                                            |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `src/core/domain/maidenhead.ts`                          | `locatorToCoords`, `coordsToLocator`, `isValidLocator` (4–10 char)                              |
| `src/core/domain/geoDistance.ts`                         | `haversineDistanceM`, `initialBearingDeg`, `pathMetricsBetween`, formatters                     |
| `src/core/domain/maidenheadGrid.ts`                      | Grid line/label geometry for map overlay                                                        |
| `src/app/routes/reference/MaidenheadReferencePage.tsx`   | Convert / Bearing mode shell                                                                    |
| `src/app/routes/reference/MaidenheadBearingSection.tsx`  | Bearing mode UI                                                                                 |
| `src/app/components/MapLocationPicker/`                  | Click/drag map picker (Convert mode)                                                            |
| `src/app/components/MapPairPlot/`                        | Dual-marker map (Bearing mode) — [sidecar](../../src/app/components/MapPairPlot/MapPairPlot.md) |
| `src/integrations/geocode/`                              | Photon + Mapbox geocode client (Photon uses shared session cache)                               |
| `src/integrations/preferences/`                          | Mapbox token in `localStorage`                                                                  |
| `src/app/hooks/useMapSettings.ts`                        | Settings ↔ preferences bridge                                                                   |
| `src/app/lib/channelLookup.ts`                           | Channel autocomplete helpers                                                                    |
| `src/app/components/channels/ChannelLocationSection.tsx` | Channel editor location block                                                                   |
| `src/core/domain/channelLocation.ts`                     | `reconcileChannelLocation` on save                                                              |

## Inputs and outputs

| Direction        | Input                                                  | Output                                             |
| ---------------- | ------------------------------------------------------ | -------------------------------------------------- |
| Locator → coords | 4, 6, 8, or 10-character Maidenhead (case-insensitive) | Centre of the finest specified square              |
| Coords → locator | WGS84 lat/lon + precision                              | Locator at chosen precision                        |
| Bearing mode     | Two valid locators (From, To)                          | Great-circle distance, bearing From→To and To→From |

## Behaviour

- Invalid characters or length → validation message on the converter; `locatorToCoords` returns `null`.
- Southern/western hemispheres: negative lat/lon handled per standard Maidenhead rules.
- Precision: 4 = field; 6 = square (~5 km); 8 = subsquare; 10 = cell.
- Bearing mode encodes map/GPS picks at 6-character precision by default.
- Geocode: Photon needs no token; repeated town/postcode lookups within a tab reuse a **sessionStorage** cache (≤5 min) and honour Photon **429** cooldown. Mapbox requires token in Settings → Map.
- Channel picker disabled without an active project; uses UUID `id` refs, not wire names.
- Only one map mounts at a time (Convert vs Bearing) to avoid Leaflet container reuse errors.

## Manual verify

### Convert

1. Visit `/reference/maidenhead` and select **Convert** (no active project required for converter/geocode).
2. Enter `IO91WM` → coordinates near London appear.
3. Change precision → locator length updates.
4. Click map / drag marker / **Use my location** → fields stay in sync.
5. Geocode a postcode (Photon); set Mapbox token in Settings and retry with Mapbox.
6. With a project active, open a channel → enter `IO91WM` or click the map → save → reload and confirm locator + coordinates persist.

### Bearing (phone or narrow viewport)

1. Select **Bearing**.
2. Tap **Use my location** under **From** (allow location when prompted).
3. Enter a **To** locator (e.g. a repeater or station grid square).
4. Confirm the hero shows bearing and distance; **Details** lists coordinates and reciprocal bearing.
5. Confirm the map shows both markers, a dashed line, and fits the pair.
6. Switch **Set on map** to **To**, tap the map → **To** locator updates.
7. Expand **More ways to set** → geocode or channel look-up still works for either side.
8. Switch to **Convert** and back → no map errors.

## Related

- [reference/](reference/README.md) · [map](map/README.md) · [repeater-directories](repeater-directories/README.md) · [bands reference](../reference/bands.md)
