# Map embed — progress

**Tracking:** [#22](https://github.com/pskillen/codeplug-studio/issues/22)  
**Branch:** `22/pskillen/map-embed-parity`

## Status

| Slice | Status | Commit |
| --- | --- | --- |
| Core map geometry + projection | Complete | pending |
| CodeplugMap component | Not started | — |
| Library embed | Not started | — |
| Remove `/map` route | Not started | — |
| Documentation | Not started | — |

## Shipped

### Slice 1 — Core map helpers

- `src/core/domain/geo.ts` — convex hull, unique lat/lon, zone colours
- `src/core/domain/mapView.ts` — bounds collection and view computation
- `src/core/domain/mapProjection.ts` — channel filters, co-locate merge, zone member resolution via `EntityRef`
- Unit tests: `geo.test.ts`, `mapView.test.ts`, `mapProjection.test.ts`

## Next

Slice 2 — `CodeplugMap` component under `src/app/components/CodeplugMap/`.
