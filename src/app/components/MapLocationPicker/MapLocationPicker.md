# MapLocationPicker

## Purpose

Small Leaflet map for picking WGS84 coordinates by click or draggable marker. Used on the Maidenhead reference tool and channel location editor.

## Props

| Prop     | Type                                 | Default | Description                                                        |
| -------- | ------------------------------------ | ------- | ------------------------------------------------------------------ |
| `lat`    | `number \| null`                     | —       | Marker latitude; null shows default UK-centred view without marker |
| `lon`    | `number \| null`                     | —       | Marker longitude                                                   |
| `onPick` | `(lat: number, lon: number) => void` | —       | Called on map click or marker drag end                             |
| `height` | `number \| string`                   | `280`   | Map container height                                               |
| `active` | `boolean`                            | `true`  | When `false`, renders a sized placeholder without `MapContainer`   |

## Usage

```tsx
import MapLocationPicker from '@app/components/MapLocationPicker/MapLocationPicker.tsx';

<MapLocationPicker
  lat={lat}
  lon={lon}
  onPick={(lat, lon) => setCoords({ lat, lon })}
  height={280}
/>;
```

## Behaviour

- Recentres when `lat`/`lon` change (zoom ≥ 10 when positioned).
- OpenStreetMap raster tiles; no Mapbox token required.
- **Maidenhead grid:** same overlay as `CodeplugMap` when enabled in Settings.
- **Map settings** link scrolls to the Map section on `/settings`.
- Waits for document layout before mounting (avoids Leaflet size glitches).
- ResizeObserver + window load invalidate map size.
- **Tabs / collapsibles:** Leaflet cannot reuse a hidden container. Pass `active={false}` (or unmount the component) when the map is not visible — e.g. channel editor Location tab passes `mapActive` via `ChannelLocationSection`. See [#208](https://github.com/pskillen/codeplug-studio/issues/208).

## Related

- [ChannelLocationSection](../channels/ChannelLocationSection.md)
- `/reference/maidenhead` route
