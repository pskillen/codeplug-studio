# SatNOGS reference

Authoritative reference for the **SatNOGS DB** transmitters API used by Codeplug Studio to enrich curated satellites with transmitter frequency, mode, and operational-status data.

This is a **remote directory / enrichment feed**, not a CPS wire format. HTTP proxy, response mapping, and merge live in [`src/integrations/satellites/`](../../../../src/integrations/satellites/) and [`src/core/domain/satnogs/`](../../../../src/core/domain/satnogs/). Feature behaviour: [satellite tracking](../../../features/satellite-tracking/README.md).

## Source

| Property              | Value                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| Publisher             | [Libre Space Foundation](https://libre.space/) — SatNOGS network                                 |
| Human site            | `https://db.satnogs.org/`                                                                        |
| API docs              | SatNOGS DB API wiki (linked from [db.satnogs.org/about](https://db.satnogs.org/about/))          |
| Transmitters endpoint | `GET /api/transmitters/`                                                                         |
| Licence               | [CC BY-SA 4.0](https://db.satnogs.org/about/) — public, freely distributed, attribution required |
| Geographic scope      | Worldwide — community-tracked satellites, not amateur-only                                       |
| Role                  | **Enrichment only** — see modelling note below                                                   |

## Enrichment, not a TLE source

SatNOGS answers a different question from [CelesTrak](../celestrak/README.md)/[AMSAT](../amsat/README.md): those feeds are the source of a satellite's **TLE** (`SatelliteSource` = `'celestrak' | 'amsat'`); SatNOGS supplies **transmitter/mode/operational-status** data for satellites already curated from a TLE source. Because these are different provenance questions, Studio models them with a separate `SatelliteEnrichmentSource` type (`'satnogs'`) rather than adding `'satnogs'` as a third `SatelliteSource` value — a satellite enriched from SatNOGS did not get its TLE from SatNOGS.

Enrichment data is **fetched and merged live per session**, not persisted as part of the `Satellite` model or the native-yaml project document — there is no `STUDIO_SCHEMA_VERSION` impact from this feed.

## CORS bridge (Studio)

SatNOGS DB does not send `Access-Control-Allow-Origin` for browser direct fetch. Studio exposes a same-origin Pages Function:

| Property    | Value                                                                                                     |
| ----------- | --------------------------------------------------------------------------------------------------------- |
| Studio path | `GET /api/satnogs/transmitters?satellite__norad_cat_id=<id>`                                              |
| Upstream    | `https://db.satnogs.org/api/transmitters/`                                                                |
| Auth        | None (public upstream; no operator API key)                                                               |
| Cache       | `Cache-Control: public, max-age=3600`                                                                     |
| Origin gate | Shared allowlist with CelesTrak/AMSAT/RadioID/RepeaterBook — deploy hostnames and `http://localhost:5173` |
| Local dev   | Vite `server.proxy` rewrites `/api/satnogs/transmitters` → `/api/transmitters/` on `db.satnogs.org`       |

Deployed via [`functions/api/satnogs/transmitters.ts`](../../../../functions/api/satnogs/transmitters.ts) on every Cloudflare Pages environment. The proxy pins `format=json` on the upstream request (SatNOGS DB's Django REST Framework browsable API serves HTML without an explicit `format`), and forwards any other query params (notably `satellite__norad_cat_id`) straight through.

## Query parameters

| Param                     | Use                                                                                                                                                                                                                                                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `satellite__norad_cat_id` | Filter transmitters to one satellite's NORAD catalog id — Studio's merge key. **Not** `norad_cat_id` — that name appears on every response record but is a read-only field on the related satellite, not a query filter; using it directly returns the full, unfiltered transmitter list (verified against the live API). |
| `format`                  | Pinned to `json` by the proxy unless the caller sets it explicitly                                                                                                                                                                                                                                                        |

Studio fetches one NORAD id per request — SatNOGS DB's transmitter filter takes a single id, not a batch. `fetchSatnogsEnrichmentForNoradIds` (`src/integrations/satellites/satnogsClient.ts`) fans out one request per satellite and collects per-id failures without aborting the whole batch.

## Response shape (JSON)

```json
[
  {
    "uuid": "UzPz4gcsNBPKPKAFPmer7g",
    "description": "Upper side band (drifting)",
    "mode": "USB",
    "downlink_low": 136658500,
    "uplink_low": 145850000,
    "alive": true,
    "status": "active",
    "norad_cat_id": 25544
  }
]
```

Additional upstream fields (`mode_id`, `baud`, `service`, `iaru_coordination`, `citation`, `updated`, `unconfirmed`, `frequency_violation`, `downlink_high`/`uplink_high`, drift fields, …) are ignored at the integration boundary — see [`SatnogsTransmitterRaw`](../../../../src/core/domain/satnogs/satnogsTypes.ts) for the exact wire shape Studio reads.

## Mapping → `SatelliteTransmitterInfo`

| API field      | Internal field (`SatelliteTransmitterInfo`)                                                                                                                      |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `uuid`         | `uuid`                                                                                                                                                           |
| `description`  | `description` (null → `''`)                                                                                                                                      |
| `mode`         | `mode` (free text, not a closed enum)                                                                                                                            |
| `downlink_low` | `downlinkHz` (Hz, same convention as `Satellite.downlinkHz`)                                                                                                     |
| `uplink_low`   | `uplinkHz` (Hz, same convention as `Satellite.uplinkHz`)                                                                                                         |
| `alive`        | `alive`                                                                                                                                                          |
| `status`       | `status` (free text, e.g. `active`/`inactive`/`invalid`)                                                                                                         |
| `norad_cat_id` | Merge key — grouped by [`groupSatnogsTransmittersByNoradId`](../../../../src/core/domain/satnogs/parseSatnogsTransmitters.ts), not copied onto the record itself |

## Merge into the satellite's transmitters

[`mergeSatnogsTransmittersIntoSatellite`](../../../../src/core/domain/satnogs/mergeSatnogsTransmitters.ts) merges freshly-fetched transmitter data directly into the persisted `Satellite.transmitters` list, matched by SatNOGS UUID (`satnogsUuid`): a fetched transmitter matching an existing `source: 'satnogs'` row updates that row in place, a fetched transmitter with no match is appended as a new row, and manually-added or previously-dismissed rows are left untouched.

**Out of scope for this integration (data-availability only):** wiring merged transmitter/mode/status data into `PassGrid` columns — see [satellite tracking hub](../../../features/satellite-tracking/README.md).

## Rate limits

Studio:

- Records a per-provider cooldown on HTTP 429 (honours `Retry-After` when present), keyed separately from CelesTrak/AMSAT under the `SatelliteEnrichmentSource` `'satnogs'`.
- Serves stale cached results on 429 when available.
- Does not auto-retry refresh requests.

## Attribution

SatNOGS DB data is [CC BY-SA 4.0](https://db.satnogs.org/about/) — Studio credits Libre Space Foundation / SatNOGS in `/attributions` ([`src/app/lib/attributions.ts`](../../../../src/app/lib/attributions.ts)).

## Related

- [satellite tracking feature hub](../../../features/satellite-tracking/README.md)
- [CelesTrak reference](../celestrak/README.md) / [AMSAT reference](../amsat/README.md) — TLE sources this enrichment layers on top of
