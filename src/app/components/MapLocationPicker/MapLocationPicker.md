# MapLocationPicker

## Purpose

Small Leaflet map for picking WGS84 coordinates by click or draggable marker. Used on the Maidenhead reference tool and channel location editor.

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `lat` | `number \| null` | — | Marker latitude; null shows default UK-centred view without marker |
| `lon` | `number \| null` | — | Marker longitude |
| `onPick` | `(lat: number, lon: number) => void` | — | Called on map click or marker drag end |
| `height` | `number \| string` | `280` | Map container height |

## Usage

```tsx
import MapLocationPicker from '@app/components/MapLocationPicker/MapLocationPicker.tsx';

<MapLocationPicker
  lat={lat}
  lon={lon}
  onPick={(lat, lon) => setCoords({ lat, lon })}
  height={280}
/>
```

## Behaviour

- Recentres when `lat`/`lon` change (zoom ≥ 10 when positioned).
- OpenStreetMap raster tiles; no Mapbox token required.
- Waits for document layout before mounting (avoids Leaflet size glitches).
- ResizeObserver + window load invalidate map size.

## Related

- [ChannelLocationSection](../channels/ChannelLocationSection.md)
- `/reference/maidenhead` route
