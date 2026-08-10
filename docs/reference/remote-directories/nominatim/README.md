# Nominatim reference

Authoritative reference for **OpenStreetMap Nominatim** address search used by Codeplug Studio's Tracking Dashboard observer-location settings.

This is a **remote geocoding API**, not a CPS wire format. HTTP proxy and client normalisation live in [`src/integrations/geocoding/`](../../../../src/integrations/geocoding/). Feature behaviour: [satellite tracking](../../../features/satellite-tracking/README.md).

## Source

| Property         | Value                                                                              |
| ---------------- | ---------------------------------------------------------------------------------- |
| Publisher        | [OpenStreetMap Foundation](https://osmfoundation.org/) — Nominatim project         |
| Search endpoint  | `https://nominatim.openstreetmap.org/search`                                       |
| Usage policy     | [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/) |
| Licence          | [OpenStreetMap ODbL](https://www.openstreetmap.org/copyright) — attribute OSM      |
| Geographic scope | Worldwide                                                                          |

## CORS bridge (Studio)

Nominatim does not send `Access-Control-Allow-Origin` for browser direct fetch, and its usage policy requires an identifying `User-Agent` that browsers cannot set on `fetch()`. Studio exposes a same-origin Pages Function:

| Property    | Value                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------- |
| Studio path | `GET /api/nominatim/search?q=…&limit=…`                                                                       |
| Upstream    | `https://nominatim.openstreetmap.org/search` (`format=jsonv2` pinned server-side)                             |
| Auth        | None (public upstream; no operator API key)                                                                   |
| User-Agent  | Set server-side in the Pages Function — `CodeplugStudio/1.0 (+https://codeplug.mm9pdy.net; mm9pdy@gmail.com)` |
| Cache       | `Cache-Control: public, max-age=300`                                                                          |
| Origin gate | Shared allowlist with CelesTrak/AMSAT/RadioID/RepeaterBook — deploy hostnames and `http://localhost:5173`     |
| Local dev   | Vite `server.proxy` mirrors the path, pins `format=jsonv2`, and injects the User-Agent upstream               |

Deployed via [`functions/api/nominatim/search.ts`](../../../../functions/api/nominatim/search.ts) on every Cloudflare Pages environment.

## Query parameters

Studio forwards only these to upstream — no operator or project data beyond the search term:

| Param   | Use                                                              |
| ------- | ---------------------------------------------------------------- |
| `q`     | Free-text search query (address, place name, postcode, …)        |
| `limit` | Max results, capped server-side at 10 regardless of client value |

`format=jsonv2` is pinned server-side and not client-controlled — without it Nominatim serves its interactive HTML search UI instead of JSON.

## Response shape (JSON, `format=jsonv2`)

```json
[
  {
    "place_id": 12345678,
    "lat": "55.8642",
    "lon": "-4.2518",
    "display_name": "Glasgow, Glasgow City, Scotland, G2 1AL, United Kingdom",
    "boundingbox": ["55.79", "55.93", "-4.35", "-4.13"]
  }
]
```

Additional fields (`osm_type`, `osm_id`, `class`, `type`, `importance`, …) are ignored at the integration boundary.

## Mapping → observer location

| API field      | Internal field                                                                                                                                     |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lat`, `lon`   | `TrackingSettings.location` (`{ lat, lon }`, parsed from string)                                                                                   |
| `display_name` | Result label shown in the search combobox; not persisted                                                                                           |
| _(derived)_    | `TrackingSettings.maidenheadLocator` — recomputed via [`coordsToLocator`](../../../../src/core/domain/maidenhead.ts) from the selected `lat`/`lon` |
| _(fixed)_      | `TrackingSettings.positionSource` = `'address'`                                                                                                    |

Internal model semantics: [satellite tracking feature hub](../../../features/satellite-tracking/README.md).

## Rate limits

Nominatim's usage policy caps **public API usage at 1 request/second**, and requires an identifying `User-Agent` (or `Referer`) on every request — omitting it risks a block. Studio:

- Sets the identifying User-Agent server-side (Pages Function and Vite dev proxy) — never relies on the browser's default UA.
- Debounces the address search input **client-side** at 300ms before issuing a request, so normal typing cannot exceed 1 req/s.
- Does **not** rate-limit inside the Pages Function itself — no proxy in this repo does; the debounce is the enforcement point.
- Does not auto-retry search requests.

Bulk/heavy usage (tile caching, systematic queries) is out of scope for this integration — Studio only issues one-off interactive address searches.

## Related

- [satellite tracking feature hub](../../../features/satellite-tracking/README.md) — observer location settings workflow
- [CelesTrak reference](../celestrak/README.md) — sibling public-feed CORS proxy pattern (no User-Agent requirement)
- [RepeaterBook reference](../repeaterbook/README.md) — sibling proxy pattern requiring a custom User-Agent
