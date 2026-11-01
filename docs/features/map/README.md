# Channel map

Tier-1 reference for the **embedded channel map** — plotting library channels with a location on react-leaflet maps inside library list routes.

**Tracking:** [#22](https://github.com/pskillen/codeplug-studio/issues/22) (replaces standalone `/map` from [#11](https://github.com/pskillen/codeplug-studio/issues/11))

**Source:** `src/app/components/CodeplugMap/`, `src/core/domain/geo.ts`, `mapView.ts`, `mapProjection.ts`

**Known deferrals:** summary inset polish / Mapbox settings — [#344](https://github.com/pskillen/codeplug-studio/issues/344)

## Where the map lives

There is **no** top-level Map nav item. Legacy `/map` bookmarks redirect to `/library/channels`.

| List route          | Map behaviour                                                                                                                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/library/channels` | Map plots the same filtered channel set as the list (name, band, mode, duplex, distance). Desktop: table left, sticky viewport-height map right. Mobile: full-screen map under a bottom sheet |
| `/library/zones`    | Full library map beside the zone DataTable (same desktop / mobile pattern)                                                                                                                    |
| `/summary`          | Full-library overview map with click-through to channel and zone editors                                                                                                                      |

Summary and list routes each embed a map — list pages keep contextual maps for their workflow; Summary provides the library-wide overview.

## Layout patterns ([#1498](https://github.com/pskillen/codeplug-studio/issues/1498))

| Surface                                                                     | Status      | Desktop                                                     | Mobile                                                                                                                             |
| --------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Channels / Zones lists                                                      | Shipped     | List left, sticky map filling the viewport below the chrome | Full-screen map, bottom sheet (peek / half / full), Map \| List toggle; full-bleed route                                           |
| Zone editor map                                                             | Shipped     | Sticky column beside members, viewport-relative height      | After the members, viewport-relative height                                                                                        |
| New zone from location                                                      | Shipped     | Controls + sticky map, results and name below               | Folding panels with summaries; map thumbnail opens a full-screen picker ("Use this point"); create button pinned above the tab bar |
| Repeater directory search                                                   | Shipped     | Sticky map beside the results table                         | Map above results, `clamp(240px, 45dvh, 460px)`                                                                                    |
| Tracking / satellite maps, aviation airport search, channel location editor | Not started | Fixed heights unchanged                                     | Fixed heights unchanged                                                                                                            |

See the [styleguide map layouts](../../reference/styleguide/README.md#map-layouts) for when to pick which.

## Component stack

```text
ChannelsListPage / ZonesListPage / SummaryPage / …
└─ ListMapLayout (src/app/components/v2/) — desktop sticky split, mobile map + bottom sheet ([#1498](https://github.com/pskillen/codeplug-studio/issues/1498))
   └─ CodeplugMap (src/app/components/CodeplugMap/)
      ├─ MapControls — label + zone toggles
      ├─ MaidenheadGridLayer — optional locator grid (Settings)
      ├─ mapProjection — filter, merge, zone member resolution
      ├─ geo — convex hull, zone colours
      └─ mapView — auto bounds / single-point zoom
```

Location pickers (`MapLocationPicker`) use the same `MapPanel` chrome on channel editor, APRS geo editor, and the My locator tool (the Field tools use `FieldMap`).

Mode marker colours come from `src/app/lib/channelModes.ts` (`modeColor`). The core layer returns `ChannelMode` values only — no UI colours in `src/core/`.

Tiles: OpenStreetMap via react-leaflet. Leaflet default marker assets are not used; markers are `L.divIcon` dots (see `CodeplugMap.css`).

## Boundaries

- Map UI in `src/app/` only; reads library `Channel` / `Zone` via props or `useLibrary()`.
- No vendor/format concepts on the map surface.
- Zone membership resolves via UUID `EntityRef` on `Zone.members` — not wire names.

## Related

- [ListMapLayout](../../../src/app/components/v2/ListMapLayout.md) — list+map composition: sticky map on desktop, map-first bottom sheet on mobile
- [MapSheet](../../../src/app/components/v2/MapSheet.md) — the mobile bottom sheet
- [channels.md](channels.md) — marker filters, labels, popups
- [zones.md](zones.md) — hull geometry, member resolution
- [#261](https://github.com/pskillen/codeplug-studio/issues/261) — `hideFromInternalMap` channel flag (Location tab checkbox)
- [maidenhead-grid.md](maidenhead-grid.md) — optional Maidenhead grid overlay ([#45](https://github.com/pskillen/codeplug-studio/issues/45))
- [repeater-directories](../repeater-directories/README.md) — seeding channels with locations
- [maidenhead.md](../maidenhead.md) — locator conversion when placing markers
- [app-shell](../app-shell/README.md) · [library](../library/README.md)
