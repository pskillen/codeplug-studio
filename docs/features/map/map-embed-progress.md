# Map embed — progress

**Tracking:** [#22](https://github.com/pskillen/codeplug-studio/issues/22)  
**Branch:** `22/pskillen/map-embed-parity`

## Status

| Slice                          | Status   | Commit    |
| ------------------------------ | -------- | --------- |
| Core map geometry + projection | Complete | `f0208e1` |
| CodeplugMap component          | Complete | `a3b60c2` |
| Library embed                  | Complete | `2f7d9ee` |
| Remove `/map` route            | Complete | `f95aa28` |
| Documentation                  | Complete | pending   |

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

### Slice 4 — Remove standalone map route

- Removed Map from primary nav; deleted `MapPage.tsx`
- `/map` → `/library` redirect with `scrollTo: 'library-channels'`
- Summary and Help links updated

### Slice 5 — Documentation

- [README.md](README.md), [channels.md](channels.md), [zones.md](zones.md)
- [app-shell route table](../app-shell/README.md), [features index](../README.md)

## Verify

```bash
npm run format:check && npm run lint && npm run test && npm run build
```

Manual smoke:

- Library → Channels: mode markers, labels, popup → channel editor
- Library → Zones: zone hull overlay, popup → zone editor
- `/#/map` redirects and scrolls to channels map
- Primary nav: Library → Summary (no Map)
- Summary “view on map” → library channels section

## Next

Open PR — `Closes #22`.
