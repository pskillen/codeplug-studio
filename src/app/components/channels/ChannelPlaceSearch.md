# ChannelPlaceSearch

## Purpose

Find a channel's position by place in the channel editor's Location panel. Directory imports often carry only a 4-character locator (e.g. `IO64`), which lands the channel at the centre of the square; the channel name is usually the town. This offers one click to search the town in the name, or a free-text search for an address, town or postcode ([#1525](https://github.com/pskillen/codeplug-studio/issues/1525)).

## Props

| Prop        | Type                                                | Description                                                                             |
| ----------- | --------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `nameQuery` | `string \| null`                                    | Place name from the channel name (`placeQueryFromChannelName`); null hides the shortcut |
| `near`      | `{ lat: number; lon: number } \| null`              | Current position: ranks results and shows each one's distance                           |
| `onPick`    | `(lat: number, lon: number, label: string) => void` | Called with the result the operator chose                                               |

## Usage

```tsx
import ChannelPlaceSearch from '@app/components/channels/ChannelPlaceSearch.tsx';
import { placeQueryFromChannelName } from '@core/domain/channelLocation.ts';

<ChannelPlaceSearch
  nameQuery={placeQueryFromChannelName(name, callsign)}
  near={near}
  onPick={(lat, lon) => applyCoords(lat, lon)}
/>;
```

## Behaviour

- **From the channel name:** `placeQueryFromChannelName` drops the callsign, words with digits and radio words (RPT, DMR, FM, …), so `GB3TA Tandragee DMR` searches `Tandragee`. The button shows only when something place-like is left.
- **Search:** `searchPlaces` (`@integrations/geocode`) returns up to five matches, ranked towards `near` (Photon `lat`/`lon` bias, Mapbox `proximity`). Mapbox is used when a token is saved in Settings, Photon (OpenStreetMap) otherwise; the hint names the provider.
- **Privacy:** nothing is sent until the operator presses Search or the name shortcut; only the search text and the rough position used for ranking leave the browser.
- **Results** list the place, its kind (village, street, …), its 6-character locator and the distance from the current position, each with **Move here**. Nothing changes until one is picked; then the list closes and a status line says where the channel moved.
- Empty result and provider errors show inline.

## Related

- [ChannelLocationSection](ChannelLocationSection.md)
- `GeocodeCentreField` (zone from location) uses the single-result `geocodeQuery`
