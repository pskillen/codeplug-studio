# Map embed — progress

**Tracking:** [#22](https://github.com/pskillen/codeplug-studio/issues/22)  
**Branch:** `22/pskillen/map-embed-parity`

## Status

| Slice | Status | Commit |
| --- | --- | --- |
| Core map geometry + projection | Complete | `f0208e1` |
| CodeplugMap component | Complete | `a3b60c2` |
| Library embed | Complete | pending |
| Remove `/map` route | Not started | — |
| Documentation | Not started | — |

## Shipped

### Slice 1 — Core map helpers

- `src/core/domain/geo.ts` — convex hull, unique lat/lon, zone colours
- `src/core/domain/mapView.ts` — bounds collection and view computation
- `src/core/domain/mapProjection.ts` — channel filters, co-locate merge, zone member resolution via `EntityRef`
- Unit tests: `geo.test.ts`, `mapView.test.ts`, `mapProjection.test.ts`

### Slice 2 — CodeplugMap component

- `src/app/components/CodeplugMap/CodeplugMap.tsx` — mode markers, zone hulls, popups
- `src/app/components/CodeplugMap/MapControls.tsx` — label and zone toggles
- `src/app/components/CodeplugMap/CodeplugMap.css` — marker and zone styles
- `src/app/hooks/useDocumentLayoutReady.ts` — defer Leaflet mount until layout ready

### Slice 3 — Library embed

- `LibraryPage.tsx` — `CodeplugMap` in Channels and Zones sections; skipped-channel note; scroll-to-section from route state

## Next

Slice 4 — remove standalone `/map` route and redirect legacy deep links.
