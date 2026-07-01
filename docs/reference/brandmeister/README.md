# BrandMeister API (v2)

Tier-3 wire reference for the **BrandMeister Halligan API v2** as used by Codeplug Studio for repeater directory search and verify.

**Base URL:** `https://api.brandmeister.network/v2`

**Studio client:** `src/integrations/repeaters/brandmeisterClient.ts`

## Endpoints used

| Endpoint                         | Method | Purpose                      |
| -------------------------------- | ------ | ---------------------------- |
| `/device/byCall?callsign={call}` | GET    | Lookup device(s) by callsign |

Browser `fetch` with CORS. Response is a single device object or an array.

## Field mapping

BrandMeister `tx` / `rx` are **MHz strings**. Studio inverts to match repeater convention (same as ETCC):

| API field               | `RepeaterListing` | Notes                                     |
| ----------------------- | ----------------- | ----------------------------------------- |
| `id`                    | `remoteId`        | stringified                               |
| `callsign`              | `callsign`        |                                           |
| `tx`                    | `rxFrequencyHz`   | repeater output (radio RX)                |
| `rx`                    | `txFrequencyHz`   | repeater input (radio TX)                 |
| `colorcode`             | `colourCode`      | DMR colour code                           |
| `lat`, `lng`            | `location`        | `{ lat, lon }`; locator derived on import |
| `city`                  | `name`            | channel display name                      |
| `statusText` / `status` | `status`          | prefers `statusText`                      |

All BrandMeister listings normalise to `modes: ['dmr']` at the boundary.

## Import behaviour

- `comment` is **not** populated on import (operator may add notes manually).
- Band wire field is empty; band pills infer from frequency in the UI.

## Known limits vs ukrepeater.net

| Capability                   | BrandMeister          | ukrepeater.net (ETCC)     |
| ---------------------------- | --------------------- | ------------------------- |
| Callsign search              | yes                   | yes                       |
| Locator / band / town search | no public v2 endpoint | yes (`searchUkRepeaters`) |
| Use my location              | not supported         | geolocation → locator     |
| Multi-mode profiles          | DMR only              | FM, DMR, D-STAR, YSF, …   |

Full API documentation: [api.brandmeister.network/docs](https://api.brandmeister.network/docs/)

## Related

- [repeater-directories feature doc](../../features/repeater-directories/README.md)
- [ukrepeater reference](../ukrepeater/README.md)
