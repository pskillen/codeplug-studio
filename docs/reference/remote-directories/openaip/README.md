# OpenAIP Core API reference

Authoritative reference for the [OpenAIP](https://www.openaip.net/) **Core API** (`https://api.core.openaip.net`) used by the airport airband directory in Codeplug Studio.

This is a **remote aviation data API**, not a CPS wire format. HTTP clients and normalisation live in [`src/integrations/aviation/`](../../../../src/integrations/aviation/). Feature behaviour: [aviation](../../../features/aviation/README.md).

## API

| Property       | Value                                                               |
| -------------- | ------------------------------------------------------------------- |
| Base URL       | `https://api.core.openaip.net`                                      |
| Auth           | Request header `x-openaip-api-key` (operator key from Settings)     |
| Response shape | Paginated `{ items, totalCount, totalPages, page, nextPage }`       |
| CORS           | Callable from the browser SPA when key is valid                     |
| Attribution    | Required — see [aviation hub](../../../features/aviation/README.md) |

Official docs: [docs.openaip.net](https://docs.openaip.net/#/).

### Endpoints (shipped)

| Endpoint            | Query params (shipped)                     | Returns                    |
| ------------------- | ------------------------------------------ | -------------------------- |
| `GET /api/airports` | `search`, `searchOptLwc` (text)            | ICAO / IATA / name matches |
| `GET /api/airports` | `pos` (`lat,lon`), `dist` (metres, radius) | Airports near a point      |
| `GET /api/airports` | `page`, `limit` (pagination)               | Client follows `nextPage`  |

**Coordinate order:** `pos` is **`latitude,longitude`**.

Town and Maidenhead locator searches geocode to a point (Mapbox or Photon), then call the radius endpoint. ICAO (4 letters), IATA (3 letters), and free-text name use the `search` parameter.

## Airport record (sample)

```json
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "Glasgow International Airport",
  "icaoCode": "EGPF",
  "iataCode": "GLA",
  "type": 2,
  "elevation": { "value": 8, "unit": 0 },
  "geometry": {
    "type": "Point",
    "coordinates": [-4.43306, 55.87194]
  },
  "frequencies": [
    {
      "value": "119.100",
      "type": 14,
      "name": "Tower",
      "primary": true
    }
  ]
}
```

## Field mapping

| OpenAIP wire              | `AirportListing` / import input       |
| ------------------------- | ------------------------------------- |
| `_id`                     | `openAipId`                           |
| `name`                    | `name`                                |
| `icaoCode`                | `icao` (uppercased)                   |
| `iataCode`                | `iata` (uppercased)                   |
| `elevation.value`         | `elevationM`                          |
| `geometry.coordinates[0]` | `location.lon`                        |
| `geometry.coordinates[1]` | `location.lat`                        |
| `frequencies[].value`     | MHz string → `rxFrequencyHz` (Hz int) |
| `frequencies[].type`      | Service label via type enum or `name` |
| `frequencies[].name`      | Preferred over type enum when set     |

## Frequency `type` enum

When `name` is absent, Studio maps OpenAIP `type` integers to service labels (e.g. `14` → Tower, `15` → ATIS). Full table: `src/integrations/aviation/openaip/frequencyTypes.ts`.

## Library channel generation

At import, `generateChannelsFromAirport` (`src/core/domain/airband/generate.ts`) projects each civil airband frequency into a normal library `Channel`:

| Generated field  | Value                                          |
| ---------------- | ---------------------------------------------- |
| `modeProfiles`   | Single AM profile (default 12.5 kHz bandwidth) |
| `rxFrequency`    | Hz from OpenAIP MHz wire                       |
| `txFrequency`    | `null`                                         |
| `forbidTransmit` | `true` (default)                               |
| `name`           | `{IATA or ICAO} {service}` (e.g. `GLA Tower`)  |
| `location`       | Airport coordinates when present               |

Frequencies outside the civil airband band catalog (`bandFromFrequencyMhz` → `airband`) are **skipped** at generation — not an error.

Dedup on import uses existing channel-set rules (`classifyChannelSetDedup`): skip by matching RX Hz or name.

## Operator key storage

API key is stored in browser `localStorage` only (`OPENAIP_API_KEY` preference). Never committed to the repo.

## Related

- [aviation feature hub](../../../features/aviation/README.md)
- [bands.md](../../bands.md) — airband category
- [anytone/am-air.md](../../formats/anytone/am-air.md) — Anytone `AMAir.CSV` export (receive-only partition)
