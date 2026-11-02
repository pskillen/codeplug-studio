# Meshflow API reference (Meshtastic nearby nodes)

Reference for the **Meshflow** public endpoint that lists Meshtastic infrastructure nodes (routers and repeaters) near a point. Studio shows them as a display-only source on **Tools → Nearby repeaters**.

This is a **remote directory API**, not a CPS wire format. The client lives in [`src/integrations/meshflow/`](../../../../src/integrations/meshflow/). Feature behaviour: [field tools](../../../features/field-tools/README.md).

## API

| Property      | Value                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------ |
| Base URL      | `https://meshflow.pskillen.xyz/api`                                                              |
| Override      | `VITE_MESHFLOW_API_BASE_URL` (local Meshflow: `http://localhost:8000/api`); trailing `/` removed |
| Auth          | None. Studio sends `credentials: 'omit'`                                                         |
| CORS          | `Access-Control-Allow-Origin: *`. Simple GET only: no custom headers, so no preflight            |
| Stability     | New endpoint; degrade gracefully (the source shows an error and the others still render)         |
| Upstream work | [meshflow-api#432](https://github.com/pskillen/meshflow-api/issues/432)                          |

## Endpoint

`GET /nodes/observed-nodes/infrastructure/nearby/`

| Param                    | Required | Server behaviour                 | What Studio sends                                   |
| ------------------------ | -------- | -------------------------------- | --------------------------------------------------- |
| `lat`, `lon`             | Yes      | 400 when missing or out of range | The search point rounded to 2 decimals (about 1 km) |
| `radius_km`              | No       | Default 25; clamped to 1 to 100  | `ceil(radius) + 1`, clamped to 1 to 100             |
| `last_heard_within_days` | No       | Default 30; clamped to 1 to 365  | `30`                                                |
| `include_client_base`    | No       | Adds `CLIENT_BASE` nodes         | Not sent                                            |

The extra kilometre covers the rounding of the point. Studio applies the exact radius itself when ranking. Results are unpaginated, nearest first, capped at 500; `meta.truncated` is true when the cap applied. Errors are `{"error": "<message>"}` with the same CORS header.

## Response sample (synthetic)

```json
{
  "results": [
    {
      "internal_id": "00000000-0000-4000-8000-000000000001",
      "node_id_str": "!0000a001",
      "long_name": "Test Hill Router",
      "short_name": "THR",
      "meshtastic_role": 2,
      "meshtastic_role_label": "ROUTER",
      "meshtastic_hw_model": "RAK4631",
      "last_heard": "2026-11-02T11:03:17Z",
      "latitude": 55.87,
      "longitude": -4.24,
      "altitude": 190,
      "distance_km": 3.4
    }
  ],
  "meta": {
    "lat": 55.86,
    "lon": -4.25,
    "radius_km": 25,
    "last_heard_within_days": 30,
    "count": 1,
    "truncated": false
  }
}
```

## Field mapping

Wire field, to the normalised `MeshtasticInfrastructureNode`, to the Nearby row.

| Wire field              | Node field      | Nearby row                                                                 |
| ----------------------- | --------------- | -------------------------------------------------------------------------- |
| `node_id_str`           | `nodeId`        | Key `meshtastic:<id>`; callsign fallback when there is no short name       |
| `short_name`            | `shortName`     | Callsign slot (bold)                                                       |
| `long_name`             | `longName`      | Name slot (blank when equal to the callsign)                               |
| `meshtastic_role_label` | `role`          | Humanised, first part of the detail line                                   |
| `last_heard`            | `lastHeardAt`   | "heard N h ago", second part of the detail line                            |
| `latitude`, `longitude` | `location`      | Position for ranking and the map marker                                    |
| `altitude`              | `altitudeM`     | Not shown                                                                  |
| `meshtastic_hw_model`   | `hardwareModel` | Not shown                                                                  |
| `internal_id`           | not read        | Unused                                                                     |
| `meshtastic_role`       | not read        | Unused (the label is used)                                                 |
| `distance_km`           | not read        | Unused: Studio recomputes distance and bearing like for every other source |
| `meta.lat`, `meta.lon`  | not read        | Unused                                                                     |

Rows without a non-empty `node_id_str`, or without finite in-range `latitude` and `longitude`, are skipped; duplicate ids keep the first (nearest). Row slots that mesh nodes do not have (frequency, band, modes, status) are empty, and the rows have no import listing, so there is no **+ Add**.

## Role labels

Known labels: `ROUTER`, `ROUTER_CLIENT`, `REPEATER`, `ROUTER_LATE` (`CLIENT_BASE` only with `include_client_base`, which Studio does not send). The client humanises any label without a lookup table: split on `_`, lower-case, capitalise the first word (`ROUTER_CLIENT` becomes "Router client"). Unknown labels pass through the same way.

## Caching, limits and privacy

- Responses are cached for the session for 5 minutes (`meshflow-api:` prefix in `sessionStorage`).
- A 429 starts a cooldown during which Studio does not call Meshflow again.
- A search radius above 100 km is searched at 100 km, and Studio says so. When `meta.truncated` is true Studio says only the nearest 500 nodes were returned.
- Meshflow is only called when the **Meshtastic** chip is on. The exact search point never leaves the browser: only the 2-decimal rounded point is sent. Meshflow is credited on `/attributions`.
