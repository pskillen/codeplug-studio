# PlaceInput

One-line point entry for the Field tools (locator, address, postcode, library channel or GPS).

## Purpose

Shared by My locator (lookup box), Distance & bearing (points A and B) and Nearby repeaters (search point). Wraps `resolvePlace` (`src/app/lib/resolvePlace.ts`): a valid Maidenhead locator wins, then a library channel with coordinates (exact callsign or name, only when `channels` is supplied), then a geocoded address or postcode (Mapbox when a token is saved, otherwise Photon).

## Props

| Prop          | Type                      | Notes                                                      |
| ------------- | ------------------------- | ---------------------------------------------------------- |
| `label`       | `string`                  | Accessible label ("Point A")                               |
| `placeholder` | `string`                  | Defaults to a locator / address / callsign hint            |
| `badge`       | `{ text, colour }`        | Round A / B chip before the field                          |
| `place`       | `Place \| null`           | Current value; changing it from outside refreshes the text |
| `onPlace`     | `(place \| null) => void` | Fires after a successful resolve, GPS fix or clear         |
| `channels`    | `Channel[]`               | Open project's channels; omit when no project is open      |
| `allowGps`    | `boolean`                 | GPS button (default true)                                  |
| `clearable`   | `boolean`                 | Clear button when a place is set                           |

## Behaviour

- Resolves on Enter, on picking a suggestion, or the search button. Suggestions are library channels with coordinates.
- Errors (no results, geocode failure, GPS denied) show inline under the field; the previous place is kept.
- Beneath the field it shows the resolved locator and coordinates.
- Nothing is stored; the parent owns the point.

## Related

- [docs/features/field-tools/README.md](../../../../docs/features/field-tools/README.md)
