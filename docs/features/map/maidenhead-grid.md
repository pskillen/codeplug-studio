# Maidenhead grid overlay

Maidenhead locator grid lines and cell labels on embedded `CodeplugMap` instances — controlled from **Settings → Map**.

**Tracking:** [#45](https://github.com/pskillen/codeplug-studio/issues/45)

## Purpose

Gives geographic context when working with Maidenhead locators (channel list maps, zone maps, channel CRUD display). Grid math matches [`src/core/domain/maidenhead.ts`](../../../src/core/domain/maidenhead.ts).

## Code anchors

| Path                                                     | Role                                                 |
| -------------------------------------------------------- | ---------------------------------------------------- |
| `src/core/domain/maidenheadGrid.ts`                      | `computeGridLines`, `computeGridLabels`, zoom gating |
| `src/app/components/CodeplugMap/MaidenheadGridLayer.tsx` | Leaflet polylines + pill-badge cell labels           |
| `src/app/hooks/useMapSettings.ts`                        | `maidenheadGrid` mode + `localStorage` persistence   |
| `src/integrations/preferences/index.ts`                  | `loadMaidenheadGridMode` / `saveMaidenheadGridMode`  |
| `src/app/routes/SettingsPage.tsx`                        | Grid overlay select control                          |

## Settings

Maximum locator precision — finer detail unlocks as you zoom in.

| Option             | Max precision | Zoom &lt; 10 | Zoom 10–14 | Zoom ≥ 15 |
| ------------------ | ------------- | ------------ | ---------- | --------- |
| Off                | `off`         | none         | none       | none      |
| Up to 4 characters | `4`           | 4-char       | 4-char     | 4-char    |
| Up to 6 characters | `6`           | 4-char       | 6-char     | 6-char    |
| Up to 8 characters | `8`           | 4-char       | 6-char     | 8-char    |

Lines are cumulative (coarser grids stay visible). Labels show only the finest active level.

**Storage key:** `codeplug-studio:maidenheadGrid` (browser `localStorage` only).

## Visual design

Intentionally reworked from the archive `codeplug-tool` overlay:

- **Lines:** level 4 solid; level 6 dashed; level 8 dotted — stronger level-4 contrast for typical library map zooms (z6–9).
- **Labels:** small pill badges (semi-opaque surface + border) instead of transparent text with white halo.
- **Density:** labels omitted when estimated cell width on screen is below ~48px.

## Behaviour

- Viewport-scoped: lines and labels recompute on pan/zoom (`moveend` / `zoomend`).
- Setting value is **maximum resolution**; actual detail is the finest level allowed at the current zoom (thresholds: 6-char at zoom **≥ 10**, 8-char at zoom **≥ 15** when max permits).
- Rendered below zone hulls and channel markers.
- Applies to `CodeplugMap` on `/library/channels` and `/library/zones` only — not `MapLocationPicker` on reference or channel editor routes.

## Manual verify

1. `/settings` → **Up to 4 characters** → open `/library/channels` with geolocated channels.
2. Confirm ~2° × 1° lines and 4-char labels (e.g. `IO85` over Glasgow).
3. Set **Up to 6 characters** → zoom out shows 4-char only; zoom to 10+ for 6-char lines/labels.
4. Set **Up to 8 characters** → zoom to 15+ for 8-char detail.
5. Pan/zoom → grid updates; setting persists after reload.
6. **Off** → no grid overlay.

## Related

- [Map hub](README.md) · [Maidenhead conversion](../maidenhead.md)
