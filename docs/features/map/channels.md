# Channels layer

Channel markers and popups — how library `Channel` records become points on the embedded map.

See the [map hub](README.md) for overall placement. This layer reads the **internal library model** ([`Channel`](../data-model/README.md)); CPS parsing belongs to import/export, not here.

## Code anchors

| Symbol                                         | File                                             | Role                                          |
| ---------------------------------------------- | ------------------------------------------------ | --------------------------------------------- |
| `applyFilters`                                 | `src/core/domain/mapProjection.ts`               | Plot vs skip by coordinates and `useLocation` |
| `groupByCoords`                                | same                                             | Merge channels at identical lat/lon           |
| `buildChannelById`                             | same                                             | Plotted channels indexed by `id`              |
| `primaryMode` / `dominantMode` / `markerLabel` | same                                             | Marker colour mode and label text             |
| `CodeplugMap`                                  | `src/app/components/CodeplugMap/CodeplugMap.tsx` | react-leaflet markers + popups                |
| `modeColor`                                    | `src/app/lib/channelModes.ts`                    | Mode → hex colour (app layer only)            |

## Inputs — the `Channel` model

| Field                               | Used for                                                                            |
| ----------------------------------- | ----------------------------------------------------------------------------------- |
| `name`                              | Popup title, full-name label                                                        |
| `callsign`                          | Default marker label                                                                |
| `location` (`{ lat, lon } \| null`) | Marker position; `null` → skipped                                                   |
| `useLocation`                       | Filter — `false` excludes when the fixed filter is on                               |
| `modeProfiles[]`                    | Marker colour from `modeProfiles[0].mode`; multi-profile label shows combined modes |
| `rxFrequency`, `txFrequency`        | Popup MHz line (stored Hz, displayed via `hzToMhzString`)                           |

## Controls and filters

[`MapControls`](../../../src/app/components/CodeplugMap/MapControls.tsx) exposes two display toggles; coordinate filters are **fixed**.

| Control / filter             | Default | Effect                                      |
| ---------------------------- | ------- | ------------------------------------------- |
| Label with full channel name | off     | `callsign — name` vs callsign only          |
| Draw zones                   | on      | Show/hide zone hulls — [zones.md](zones.md) |
| Require `useLocation`        | on      | Skips channels with `useLocation === false` |
| Skip `0,0`                   | on      | Skips channels at exactly `0, 0`            |

Skipped channels are summarised below the map on the channels and zones list routes (count + reasons).

## Behaviour

### Plot vs skip

`applyFilters` walks the channel list once. A channel is **plotted** only when it has a non-null `location`, passes the `useLocation` check, and is not at `0,0` (when skip-zero is on).

### Co-located merge

`groupByCoords(..., true)` groups channels whose lat/lon match at five decimal places. One marker is drawn; the label shows `callsign +N` for merged groups. Marker colour uses `dominantMode` (most common `modeProfiles[0].mode` in the group).

### Popups

Each marker popup lists every channel in the group: name, mode summary (`modeProfiles` → labels), RX/TX MHz, and an **Edit channel** action when `onChannelClick` is wired (Library navigates to `/library/channels/:id`).

### Auto bounds

`FitMapBounds` gathers marker and (optional) zone points via `collectMapPoints` / `computeMapView` with padding `[48, 48]`, `maxZoom: 11`, and `setView` at zoom 11 for a single point (avoids Leaflet infinite-tile loads on zero-area bounds).

## Related

- [zones.md](zones.md) · [map hub](README.md) · [channel-modes reference](../../reference/channel-modes.md)
