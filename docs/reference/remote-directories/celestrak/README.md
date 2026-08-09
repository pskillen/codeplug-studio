# CelesTrak reference

Authoritative reference for the **CelesTrak** amateur-satellite TLE (Keplerian element) feed used by Codeplug Studio's Satellite Keps library as the primary upstream source.

This is a **remote directory feed**, not a CPS wire format. HTTP proxy, TLE parsing, and merge live in [`src/integrations/satellites/`](../../../../src/integrations/satellites/) and [`src/core/domain/tle/`](../../../../src/core/domain/tle/). Feature behaviour: [satellite keps](../../../features/satellite-keps/README.md).

## Source

| Property         | Value                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| Publisher        | [CelesTrak](https://celestrak.org/) (Dr. T.S. Kelso)                                                        |
| Endpoint         | `https://celestrak.org/NORAD/elements/gp.php?GROUP=amateur&FORMAT=tle`                                      |
| Licence          | Public feed; no API key. See [CelesTrak FAQ](https://celestrak.org/NORAD/documentation/gp-data-formats.php) |
| Geographic scope | Worldwide — amateur-radio satellite group only                                                              |
| Role             | **Primary** upstream source; [AMSAT](../amsat/README.md) is the fallback                                    |

## CORS bridge (Studio)

CelesTrak does not send `Access-Control-Allow-Origin` for browser direct fetch. Studio exposes a same-origin Pages Function:

| Property    | Value                                                                                           |
| ----------- | ----------------------------------------------------------------------------------------------- |
| Studio path | `GET /api/celestrak/amateur`                                                                    |
| Upstream    | `https://celestrak.org/NORAD/elements/gp.php?GROUP=amateur&FORMAT=tle`                          |
| Auth        | None (public upstream; no operator API key)                                                     |
| Cache       | `Cache-Control: public, max-age=3600`                                                           |
| Origin gate | Shared allowlist with AMSAT/RadioID/RepeaterBook — deploy hostnames and `http://localhost:5173` |
| Local dev   | Vite `server.proxy` mirrors the path                                                            |

Deployed via [`functions/api/celestrak/amateur.ts`](../../../../functions/api/celestrak/amateur.ts) on every Cloudflare Pages environment. No custom `User-Agent` is required — unlike [Nominatim](../nominatim/README.md), CelesTrak's public feed has no identifying-header policy.

## Response shape (TLE text)

Plain-text, three lines per satellite (name + two TLE data lines), e.g.:

```text
ISS (ZARYA)
1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9994
2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.49560371    23
```

Parsed by [`parseTleBlock`](../../../../src/core/domain/tle/parseTle.ts) into `ParsedTleEntry[]` (name, NORAD id, epoch, and decoded orbital elements) — malformed 3-line groups are collected as warnings, not thrown.

## Mapping → `Satellite`

| TLE field (decoded)                                                                                | `Satellite` field                                                                                                         |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Line 0 name                                                                                        | `name`                                                                                                                    |
| Line 1 NORAD catalog number                                                                        | `noradId` — merge key (see below)                                                                                         |
| Line 1 epoch                                                                                       | `epoch` (ISO 8601)                                                                                                        |
| Line 1 classification, B\*, element set number                                                     | `classification`, `bstar`, `elementSetNumber`                                                                             |
| Line 2 inclination, RAAN, eccentricity, arg. perigee, mean anomaly, mean motion, revolution number | `inclinationDeg`, `raanDeg`, `eccentricity`, `argPerigeeDeg`, `meanAnomalyDeg`, `meanMotionRevPerDay`, `revolutionNumber` |
| Raw lines 1 and 2                                                                                  | `tleLine1`, `tleLine2` — **propagation source of truth**; decoded fields above are display-only and never re-encoded      |
| _(fixed)_                                                                                          | `source` = `'celestrak'`                                                                                                  |

## Merge into the curated library

[`fetchSatelliteSet`](../../../../src/integrations/satellites/fetchSatelliteSet.ts) tries CelesTrak first, falling back to AMSAT on failure or rate limit. [`mergeSatelliteSet`](../../../../src/integrations/satellites/mergeSatelliteSet.ts) keys by `noradId`: new entries are added, changed TLE lines update in place (preserving `id`/`enabled`/`revision`), and satellites absent from the fresh fetch are **kept, not deleted** — there is no upstream directive to prune a curated list.

## Rate limits

Studio:

- Records a per-provider cooldown on HTTP 429 (honours `Retry-After` when present).
- Serves stale session-cached results on 429 when available.
- Does not auto-retry refresh requests.

## Related

- [satellite keps feature hub](../../../features/satellite-keps/README.md)
- [AMSAT reference](../amsat/README.md) — fallback source, same proxy pattern
