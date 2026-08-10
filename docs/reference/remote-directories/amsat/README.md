# AMSAT reference

Authoritative reference for the **AMSAT** current amateur-satellite TLE (Keplerian element) feed used by Codeplug Studio's Satellite Keps library as the fallback upstream source when [CelesTrak](../celestrak/README.md) is unreachable or rate-limited.

This is a **remote directory feed**, not a CPS wire format. HTTP proxy, TLE parsing, and merge live in [`src/integrations/satellites/`](../../../../src/integrations/satellites/) and [`src/core/domain/tle/`](../../../../src/core/domain/tle/). Feature behaviour: [satellite keps](../../../features/satellite-keps/README.md).

## Source

| Property         | Value                                                                 |
| ---------------- | --------------------------------------------------------------------- |
| Publisher        | [AMSAT](https://www.amsat.org/) — Radio Amateur Satellite Corporation |
| Endpoint         | `https://www.amsat.org/tle/current/nasabare.txt`                      |
| Licence          | Public feed; no API key                                               |
| Geographic scope | Worldwide — amateur-radio satellites AMSAT tracks                     |
| Role             | **Secondary/fallback** — used when CelesTrak fails or is rate-limited |

## CORS bridge (Studio)

AMSAT does not send `Access-Control-Allow-Origin` for browser direct fetch. Studio exposes a same-origin Pages Function:

| Property    | Value                                                                                               |
| ----------- | --------------------------------------------------------------------------------------------------- |
| Studio path | `GET /api/amsat/nasabare`                                                                           |
| Upstream    | `https://www.amsat.org/tle/current/nasabare.txt`                                                    |
| Auth        | None (public upstream; no operator API key)                                                         |
| Cache       | `Cache-Control: public, max-age=3600`                                                               |
| Origin gate | Shared allowlist with CelesTrak/RadioID/RepeaterBook — deploy hostnames and `http://localhost:5173` |
| Local dev   | Vite `server.proxy` mirrors the path                                                                |

Deployed via [`functions/api/amsat/nasabare.ts`](../../../../functions/api/amsat/nasabare.ts) on every Cloudflare Pages environment. No custom `User-Agent` is required — unlike [Nominatim](../nominatim/README.md), AMSAT's public feed has no identifying-header policy.

## Response shape (TLE text)

Same "NASA bare" three-line-per-satellite plain-text format as CelesTrak's feed — parsed by the same [`parseTleBlock`](../../../../src/core/domain/tle/parseTle.ts) into `ParsedTleEntry[]`.

## Mapping → `Satellite`

Identical field mapping to [CelesTrak](../celestrak/README.md#mapping--satellite), except `source` is set to `'amsat'` instead of `'celestrak'` — see that reference for the full decoded-field table. Both feeds populate the same `Satellite` model; TLE lines are the propagation source of truth regardless of which upstream supplied them.

## Merge into the curated library

Reached only when [`fetchSatelliteSet`](../../../../src/integrations/satellites/fetchSatelliteSet.ts)'s CelesTrak attempt throws (network failure or rate limit). Same [`mergeSatelliteSet`](../../../../src/integrations/satellites/mergeSatelliteSet.ts) keyed-by-`noradId` merge as CelesTrak applies here — a fallback fetch does not distinguish its merge behaviour from a primary one.

## Rate limits

Studio:

- Records a per-provider cooldown on HTTP 429 (honours `Retry-After` when present).
- Serves stale session-cached results on 429 when available.
- Does not auto-retry refresh requests.

## Related

- [satellite keps feature hub](../../../features/satellite-keps/README.md)
- [CelesTrak reference](../celestrak/README.md) — primary source, same proxy pattern
