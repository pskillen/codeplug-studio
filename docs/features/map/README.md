# Channel map

Tier-1 reference for the Phase 2 **channel map** — plotting library channels with a location on a react-leaflet map.

**Tracking:** Phase 2 [#11](https://github.com/pskillen/codeplug-studio/issues/11) (Epic [#1](https://github.com/pskillen/codeplug-studio/issues/1))

**Source:** `src/app/routes/MapPage.tsx`, `src/app/components/map/`, `src/core/domain/maidenhead.ts`

## Map (`/map`)

Plots library channels that have a location (`useLocation` + `location`) on a [react-leaflet](https://react-leaflet.js.org/) map with OpenStreetMap tiles. Marker popups deep-link to the channel editor (`/library/channels/:id`). Channels gain a location either by manual entry or by importing from a repeater directory whose record carries a Maidenhead locator or lat/lng.

Leaflet's default marker assets are repointed at bundled URLs once in `src/app/components/map/leafletSetup.ts` (the usual Vite + Leaflet icon fix).

## Boundaries

- Map UI in `src/app/` only; uses `useLibrary()` for channel rows.
- No vendor/format concepts on the map surface.

## Related

- [repeater-directories](../repeater-directories/README.md) — seeding channels with locations from directories
- [maidenhead.md](../maidenhead.md) — locator conversion used when placing markers
- [app-shell](../app-shell/README.md) · [library](../library/README.md)
