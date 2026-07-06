# Channel map

Tier-1 reference for the **embedded channel map** — plotting library channels with a location on react-leaflet maps.

**Tracking:** [#22](https://github.com/pskillen/codeplug-studio/issues/22) (replaces standalone `/map` from [#11](https://github.com/pskillen/codeplug-studio/issues/11)); unified placement [#180](https://github.com/pskillen/codeplug-studio/issues/180)

**Source:** `src/app/components/CodeplugMap/`, `src/core/domain/geo.ts`, `mapView.ts`, `mapProjection.ts`

**Progress:** [map-embed-progress.md](map-embed-progress.md) · **Outstanding:** [map-embed-outstanding.md](map-embed-outstanding.md)

## Where the map lives

There is **no** top-level Map nav item. Legacy `/map` bookmarks redirect to `/library/zones?pivot=all`.

| Location                           | Map behaviour                                             |
| ---------------------------------- | --------------------------------------------------------- |
| `/summary`                         | **Full library** — all geolocated channels and zone hulls |
| `/library/zones` (unified screen)  | **Contextual** per pivot — all / orphans / zone-emphasis  |
| `/library/zones/new-from-location` | Proximity workflow map (radius + hull preview)            |

Legacy `/library/channels` redirects to the unified screen (no standalone list map).

## Component stack

```text
ChannelsAndZonesPage / SummaryPage / ZoneFromLocationPage
└─ CodeplugMap (src/app/components/CodeplugMap/)
   ├─ MapControls — label + zone toggles
   ├─ MaidenheadGridLayer — optional locator grid (Settings)
   ├─ mapProjection — filter, merge, zone member resolution
   ├─ geo — convex hull, zone colours
   └─ mapView — auto bounds / single-point zoom
```

Mode marker colours come from `src/app/lib/channelModes.ts` (`modeColor`). The core layer returns `ChannelMode` values only — no UI colours in `src/core/`.

Tiles: OpenStreetMap via react-leaflet. Leaflet default marker assets are not used; markers are `L.divIcon` dots (see `CodeplugMap.css`).

## Boundaries

- Map UI in `src/app/` only; reads library `Channel` / `Zone` via props or `useLibrary()`.
- No vendor/format concepts on the map surface.
- Zone membership resolves via UUID refs on `Zone.members` — not wire names.

## Related

- [zone-pivoted-ui.md](../library/zone-pivoted-ui.md) — pivot map rules
- [channels.md](channels.md) — marker filters, labels, popups
- [zones.md](zones.md) — hull geometry, member resolution
- [maidenhead-grid.md](maidenhead-grid.md) — optional Maidenhead grid overlay ([#45](https://github.com/pskillen/codeplug-studio/issues/45))
- [repeater-directories](../repeater-directories/README.md) — seeding channels with locations
- [maidenhead.md](../maidenhead.md) — locator conversion when placing markers
- [app-shell](../app-shell/README.md) · [library](../library/README.md)
