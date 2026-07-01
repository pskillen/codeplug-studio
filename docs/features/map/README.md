# Channel map

Tier-1 reference for the **embedded channel map** — plotting library channels with a location on react-leaflet maps inside library list routes.

**Tracking:** [#22](https://github.com/pskillen/codeplug-studio/issues/22) (replaces standalone `/map` from [#11](https://github.com/pskillen/codeplug-studio/issues/11))

**Source:** `src/app/components/CodeplugMap/`, `src/core/domain/geo.ts`, `mapView.ts`, `mapProjection.ts`

**Progress:** [map-embed-progress.md](map-embed-progress.md) · **Outstanding:** [map-embed-outstanding.md](map-embed-outstanding.md)

## Where the map lives

There is **no** top-level Map nav item. Legacy `/#/map` bookmarks redirect to `/library/channels`.

| List route          | Map behaviour                                                                    |
| ------------------- | -------------------------------------------------------------------------------- |
| `/library/channels` | Full library map; when distance filter is on, map shows the filtered channel set |
| `/library/zones`    | Full library map above the zone card list (tool parity — full context)           |

Summary “view on map” links to `/library/channels`.

## Component stack

```text
ChannelsListPage / ZonesListPage
└─ CodeplugMap (src/app/components/CodeplugMap/)
   ├─ MapControls — label + zone toggles
   ├─ mapProjection — filter, merge, zone member resolution
   ├─ geo — convex hull, zone colours
   └─ mapView — auto bounds / single-point zoom
```

Mode marker colours come from `src/app/lib/channelModes.ts` (`modeColor`). The core layer returns `ChannelMode` values only — no UI colours in `src/core/`.

Tiles: OpenStreetMap via react-leaflet. Leaflet default marker assets are not used; markers are `L.divIcon` dots (see `CodeplugMap.css`).

## Boundaries

- Map UI in `src/app/` only; reads library `Channel` / `Zone` via props or `useLibrary()`.
- No vendor/format concepts on the map surface.
- Zone membership resolves via UUID `EntityRef` on `Zone.members` — not wire names.

## Related

- [channels.md](channels.md) — marker filters, labels, popups
- [zones.md](zones.md) — hull geometry, member resolution
- [repeater-directories](../repeater-directories/README.md) — seeding channels with locations
- [maidenhead.md](../maidenhead.md) — locator conversion when placing markers
- [app-shell](../app-shell/README.md) · [library](../library/README.md)
