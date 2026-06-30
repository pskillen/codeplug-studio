# Map & repeater directories

Tier-1 reference for the Phase 2 channel **map** and **repeater directory** import.

**Tracking:** Phase 2 [#11](https://github.com/pskillen/codeplug-studio/issues/11) (Epic [#1](https://github.com/pskillen/codeplug-studio/issues/1))

**Source:** `src/app/routes/MapPage.tsx`, `src/app/routes/RepeatersPage.tsx`, `src/integrations/repeaters/`, `src/core/domain/maidenhead.ts`

## Map (`/map`)

Plots library channels that have a location (`useLocation` + `location`) on a [react-leaflet](https://react-leaflet.js.org/) map with OpenStreetMap tiles. Marker popups deep-link to the channel editor (`/library/channels/:id`). Channels gain a location either by manual entry or by importing from a repeater directory whose record carries a Maidenhead locator or lat/lng.

Leaflet's default marker assets are repointed at bundled URLs once in `src/app/components/map/leafletSetup.ts` (the usual Vite + Leaflet icon fix).

## Repeater directories (`/repeaters`)

Search public directories and add results to the library as **vendor-neutral channels**:

| Source                  | Client                                       | Search by         | Notes                                             |
| ----------------------- | -------------------------------------------- | ----------------- | ------------------------------------------------- |
| UK repeater (RSGB ETCC) | `searchUkRepeatersByCallsign` / `…ByLocator` | callsign, locator | `tx`/`rx` in Hz, `ctcss` Hz, Maidenhead `locator` |
| BrandMeister            | `searchBrandmeisterByCallsign`               | callsign          | DMR devices; `tx`/`rx` MHz strings, `lat`/`lng`   |

Each client normalises its wire shape into a vendor-neutral `RepeaterListing` (`src/integrations/repeaters/types.ts`); `repeaterListingToChannel` maps a listing to a library `Channel` (FM or DMR profile, frequencies in Hz, location from the locator). No wire strings or directory-specific fields leak into the library.

Frequency convention: `rxFrequencyHz` is what the radio receives (repeater output), `txFrequencyHz` what it transmits (repeater input).

## Boundaries

- HTTP clients live in `src/integrations/repeaters/`; `core` never makes network calls.
- Both APIs send permissive CORS headers, so the browser SPA calls them directly; failures surface as a `RepeaterDirectoryError` message in the UI.

## Related

- [library](../library/README.md) · [reports-and-reference](../reports-and-reference/README.md)
