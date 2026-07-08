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
- Results: map markers + per-airport cards with frequency tables.
- Single **Add** or batch **Add selected**; optional zone per airport via import plan.

## Related

- [Aviation feature hub](../../../../docs/features/aviation/README.md)
- [OpenAIP reference](../../../../docs/reference/openaip/README.md)
