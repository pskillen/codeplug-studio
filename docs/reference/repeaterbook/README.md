# RepeaterBook Export API reference

Authoritative reference for the **RepeaterBook Export API** used by Codeplug Studio for North America and rest-of-world repeater directory search, import, and verify.

This is a **remote directory API**, not a CPS wire format. HTTP clients and normalisation live in [`src/integrations/repeaters/repeaterbook/`](../../../src/integrations/repeaters/repeaterbook/). Feature behaviour: [repeater directories](../../features/repeater-directories/README.md).

## Registration

| Property                  | Value                                                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| App name                  | Codeplug Studio                                                                                                  |
| App ID                    | `103`                                                                                                            |
| User-Agent (prefix match) | `CodeplugStudio/1.0 (+https://codeplug.mm9pdy.net; mm9pdy@gmail.com)`                                            |
| Token model               | **Distributed** — each user generates `rbuapp_…` from [API Apps](https://www.repeaterbook.com/user/api_apps.php) |
| Policy                    | [RepeaterBook API wiki](https://www.repeaterbook.com/wiki/doku.php?id=api)                                       |

No shared `app_` token in source, build artefacts, or documentation.

## Authentication

| Header           | Value                                                       |
| ---------------- | ----------------------------------------------------------- |
| `X-RB-App-Token` | User's `rbuapp_…` token (preferred)                         |
| `User-Agent`     | Approved string above — **required**; prefix match enforced |

Token stored in browser `localStorage` only (`codeplug-studio:repeaterbookToken`).

### Operator token flow

1. Log in to [RepeaterBook](https://www.repeaterbook.com/).
2. Open [API Apps and Tokens](https://www.repeaterbook.com/user/api_apps.php).
3. Select **Codeplug Studio** (app ID 103).
4. Generate token — copy immediately (shown once).
5. Paste into Codeplug Studio **Settings → RepeaterBook** and Save.

## Endpoints

| Endpoint        | Scope                            | Base                                             |
| --------------- | -------------------------------- | ------------------------------------------------ |
| `export.php`    | `api.export` — North America     | `https://www.repeaterbook.com/api/export.php`    |
| `exportROW.php` | `api.export_row` — rest of world | `https://www.repeaterbook.com/api/exportROW.php` |

### Query parameters

**North America (`export.php`):** `callsign`, `city`, `landmark`, `state_id`, `country`, `county`, `frequency`, `mode`, `emcomm`, `stype` (GMRS). Callsign supports `%` wildcards.

**Rest of world (`exportROW.php`):** `callsign`, `city`, `landmark`, `country`, `region`, `frequency`, `mode`.

Studio v1 UI: region selector (NA / ROW), optional `state_id` or `country`, optional callsign; client-side band/mode/geometry filters after fetch.

## Response shape

Success JSON:

```json
{
  "count": 1,
  "status": "success",
  "results": [ { "State ID": "06", "Rptr ID": 1, "Callsign": "W6TEST", … } ]
}
```

Error JSON (HTTP 4xx or `status: "error"`):

| Code                | Meaning                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| `auth_missing`      | Token required                                                                                    |
| `auth_invalid`      | Bad token format                                                                                  |
| `auth_inactive`     | Token or app inactive                                                                             |
| `auth_revoked`      | Token revoked                                                                                     |
| `auth_scope_denied` | Token lacks endpoint scope                                                                        |
| `ua_mismatch`       | User-Agent does not match approved policy                                                         |
| `rate_limited`      | Too many requests — back off (see [#341](https://github.com/pskillen/codeplug-studio/issues/341)) |

HTTP **429** also indicates rate limiting. v1 surfaces an error; cooperative backoff deferred to shared infra.

## Listing record → `RepeaterListing`

Parse by **field name** — NA and ROW payloads differ slightly (NA may include `County`/`ARES`; ROW may omit `Region`).

| RepeaterBook field            | `RepeaterListing` / notes                          |
| ----------------------------- | -------------------------------------------------- |
| `State ID` + `Rptr ID`        | `remoteId` as `{stateId}:{rptrId}`                 |
| `Callsign`                    | `callsign`                                         |
| `Nearest City` (+ `Landmark`) | `name`                                             |
| `Frequency` (MHz string)      | `rxFrequencyHz` — repeater **output** (radio RX)   |
| `Input Freq`                  | `txFrequencyHz` — repeater **input** (radio TX)    |
| `TSQ` / `PL`                  | `toneHz` — prefer downlink (`TSQ`) CTCSS           |
| `Lat`, `Long`                 | `location` when parseable                          |
| `Operational Status`          | `status` (`On-air`, `Off-air`, …)                  |
| `Country`, `State`            | used for display; band derived from RX MHz         |
| Mode capability flags         | `modes[]`, `primaryMode`, `colourCode` — see below |

Boolean-ish fields use `"Yes"`/`"No"`, `"1"`/`"0"`, or empty string.

### Mode capability flags

| Field                 | Library mode             |
| --------------------- | ------------------------ |
| `FM Analog` = Yes     | `fm`                     |
| `DMR` = Yes           | `dmr` + `DMR Color Code` |
| `D-Star` = Yes        | `dstar`                  |
| `System Fusion` = Yes | `ysf`                    |
| `NXDN` = Yes          | `nxdn`                   |
| `APCO P-25` = Yes     | `p25`                    |
| `Tetra` = Yes         | `tetra`                  |
| `M17` = Yes           | `m17`                    |

If no digital flag matches, default to `fm` when `FM Analog` is Yes; otherwise first advertised mode.

## CORS

Distributed browser app approval implies **browser-direct** `fetch` with token + User-Agent headers. Live verification requires an operator token — see [repeaterbook-outstanding.md](../../features/repeater-directories/repeaterbook-outstanding.md).

## Attribution

UI must credit: **Data courtesy of [RepeaterBook.com](https://www.repeaterbook.com/)**.

## Caching

v1 uses a minimal in-memory session cache (5 min TTL) in the integration client. Shared sessionStorage cache tracked in [#73](https://github.com/pskillen/codeplug-studio/issues/73).

## Related

- [repeater directories feature hub](../../features/repeater-directories/README.md)
- [IRTS reference](../irts/README.md) — spike noted RepeaterBook ROW as future source
