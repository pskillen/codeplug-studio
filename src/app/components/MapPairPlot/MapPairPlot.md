# MapPairPlot

## Purpose

Leaflet map for plotting two WGS84 points (From / To) with a dashed path line and automatic fit-bounds. Used on the Maidenhead reference **Bearing** mode.

## Props

| Prop        | Type                                 | Default | Description                                                       |
| ----------- | ------------------------------------ | ------- | ----------------------------------------------------------------- |
| `pointFrom` | `MapPairPoint \| null`               | —       | From point; null hides the From marker                            |
| `pointTo`   | `MapPairPoint \| null`               | —       | To point; null hides the To marker                                |
| `labelFrom` | `string`                           | `From`  | Label under the From marker                                       |
| `labelTo`   | `string`                           | `To`    | Label under the To marker                                         |
| `onPick`    | `(lat: number, lon: number) => void` | —       | Called when the map is clicked                                    |
| `pickTarget`| `'from' \| 'to'`                     | —       | Which side the parent applies the pick to (visual hint in parent) |
| `height`    | `number \| string`                   | `200`   | Map container height                                              |
| `active`    | `boolean`                            | `true`  | When `false`, renders a sized placeholder without `MapContainer`  |

## Usage

```tsx
import MapPairPlot from '@app/components/MapPairPlot/MapPairPlot.tsx';

<MapPairPlot
  pointFrom={fromCoords}
  pointTo={toCoords}
  pickTarget={pickTarget}
  onPick={(lat, lon) => applyToSide(pickTarget, lat, lon)}
  height={200}
  active={mode === 'bearing'}
/>;
```

## Behaviour

- Fits bounds to both points when both are set; centres on one point when only one is set.
- Dashed polyline between From and To when both points are valid.
- Blue **From** and red **To** markers with short labels.
- OpenStreetMap tiles; optional Maidenhead grid overlay from Settings.
- Map click does not drag markers — the parent decides which side receives the pick via `pickTarget`.
- Pass `active={false}` when the map is hidden (e.g. Convert mode) to avoid Leaflet container reuse errors.

## Related

- [Maidenhead feature hub](../../../../docs/features/maidenhead.md)
- [MapLocationPicker](../MapLocationPicker/MapLocationPicker.md) — single-point picker for Convert mode and channel editor
