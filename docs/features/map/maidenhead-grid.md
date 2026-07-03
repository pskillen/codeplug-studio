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

Maximum locator precision — finer detail unlocks as you zoom in. Grid overlay stops at **6 characters** (8-char grid removed for performance).

| Option             | Max precision | Zoom &lt; 10 | Zoom ≥ 10 |
| ------------------ | ------------- | ------------ | --------- |
| Off                | `off`         | none         | none      |
| Up to 4 characters | `4`           | 4-char       | 4-char    |
| Up to 6 characters | `6`           | 4-char       | 6-char    |

Lines are cumulative (coarser grids stay visible). Labels show only the finest active level.

**Storage key:** `codeplug-studio:maidenheadGrid` (browser `localStorage` only). Legacy stored value `8` loads as `6`.

## Visual design

Intentionally reworked from the archive `codeplug-tool` overlay:

- **Lines:** level 4 solid; level 6 dashed — stronger level-4 contrast for typical library map zooms (z6–9).
- **Labels:** indigo text with white + tinted glow (no background box); centred on each cell.
- **Density:** labels omitted when estimated cell width on screen is below ~48px.

## Behaviour

- Viewport-scoped: lines and labels recompute on pan/zoom (`moveend` / `zoomend`).
- Setting value is **maximum resolution**; actual detail is the finest level allowed at the current zoom (6-char at zoom **≥ 10** when max permits).
- Rendered below zone hulls and channel markers.
- Applies to `CodeplugMap` on `/library/channels` and `/library/zones`, and to `MapLocationPicker` on `/reference/maidenhead` (and the channel editor location section).

## Manual verify

1. `/settings` → **Up to 4 characters** → open `/library/channels` with geolocated channels.
2. Confirm ~2° × 1° lines and 4-char labels (e.g. `IO85` over Glasgow).
3. Set **Up to 6 characters** → zoom out shows 4-char only; zoom to 10+ for 6-char lines/labels.
4. Pan/zoom → grid updates; setting persists after reload.
5. **Off** → no grid overlay.

## Related

- [Map hub](README.md) · [Maidenhead conversion](../maidenhead.md)
