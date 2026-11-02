# FieldMap

Full-size Leaflet map for the Field tools.

## Purpose

One map component for the three Field tools. Unlike `MapLocationPicker` it fills its parent (`height: 100%`), draws any number of pins and numbered markers, and fits the view only when asked.

## Props

| Prop               | Type                               | Notes                                                                                                           |
| ------------------ | ---------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `pins`             | `FieldMapPin[]`                    | Round reference pins (A, B, "you"); `draggable` pins report `onPinDrag`                                         |
| `markers`          | `FieldMapMarker[]`                 | Numbered result markers; `selected` enlarges and raises one; `textColour` sets the label colour (default white) |
| `ring`             | `{ lat, lon, radiusM } \| null`    | Dashed radius circle; the fit uses its bounds                                                                   |
| `square`           | `LatLonBounds \| null`             | Locator-square outline                                                                                          |
| `line`             | `[[lat, lon], [lat, lon]] \| null` | Dashed A to B line                                                                                              |
| `onMapClick`       | `(lat, lon) => void`               | Map background click                                                                                            |
| `onPinDrag`        | `(id, lat, lon) => void`           | Pin drag end                                                                                                    |
| `onMarkerClick`    | `(id) => void`                     | Marker click                                                                                                    |
| `fitKey`           | `string`                           | The view re-fits to the pins / ring / square only when this changes                                             |
| `fitInsetBottomPx` | `number`                           | Keeps the fit clear of a bottom sheet                                                                           |
| `fitMaxZoom`       | `number`                           | Cap for the automatic fit                                                                                       |

## Behaviour

- OpenStreetMap tiles plus the user's Maidenhead grid overlay setting (`useMapSettings`).
- Re-fitting only on `fitKey` means dragging a pin or clicking the map does not yank the view.
- Resizes with its container (`ResizeObserver`), so it works inside the desktop column layout and behind a mobile sheet.

## Related

- [MapToolLayout](./MapToolLayout.md)
- [docs/features/field-tools/README.md](../../../../docs/features/field-tools/README.md)
