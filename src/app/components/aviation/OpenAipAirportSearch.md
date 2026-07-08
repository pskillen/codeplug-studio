# OpenAipAirportSearch

## Purpose

Search [OpenAIP](https://www.openaip.net/) for airports and import RX-only AM airband channels into the library.

## Props

None — self-contained route shell.

## Usage

```tsx
import OpenAipAirportSearch from '@app/components/aviation/OpenAipAirportSearch.tsx';

export default function AddFromOpenAipPage() {
  return <OpenAipAirportSearch />;
}
```

## Behaviour

- Blocks search when OpenAIP API key is missing; links to Settings.
- Supports ICAO/IATA/name, town geocode, Maidenhead locator, and “use my location” with radius.
- Results: map markers + per-airport cards listing individual frequencies with checkboxes.
- Per-airport **Select all / none** toggles frequencies within that card; airport checkbox selects the whole airport.
- Per-airport **SplitButton**: primary **Add channels**, menu **Add as zone** (uses batch zone name field).
- Batch bar: global select all, optional **Create zone** with editable name (default `Airband`), **Add selected**.

## Related

- [Aviation feature hub](../../../../docs/features/aviation/README.md)
- [OpenAIP reference](../../../../docs/reference/openaip/README.md)
