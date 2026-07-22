# RepeaterBook Export API reference

Authoritative reference for the **RepeaterBook Export API** used by Codeplug Studio for North America and rest-of-world repeater directory search, import, and verify.

This is a **remote directory API**, not a CPS wire format. HTTP clients and normalisation live in [`src/integrations/repeaters/repeaterbook/`](../../../../src/integrations/repeaters/repeaterbook/). Feature behaviour: [repeater directories](../../../features/repeater-directories/README.md).

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

| Code                | Meaning                                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `auth_missing`      | Token required                                                                                                          |
| `auth_invalid`      | Bad token format                                                                                                        |
| `auth_inactive`     | Token or app inactive                                                                                                   |
| `auth_revoked`      | Token revoked                                                                                                           |
| `auth_scope_denied` | Token lacks endpoint scope                                                                                              |
| `ua_mismatch`       | User-Agent does not match approved policy                                                                               |
| `rate_limited`      | Too many requests — back off immediately ([RepeaterBook API policy](https://www.repeaterbook.com/wiki/doku.php?id=api)) |

HTTP **429** also indicates rate limiting. Studio records a per-provider cooldown (default 60 s; honours `Retry-After`) and blocks further requests until it expires — **no automatic retry**. When a cached response exists, stale data may be served on 429 instead of failing.

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

## CORS bridge (Studio)

RepeaterBook does **not** expose browser CORS for export endpoints, and browsers cannot set the approved `User-Agent` on `fetch()`. Studio exposes a same-origin Pages Function proxy:

| Property    | Value                                                                                                |
| ----------- | ---------------------------------------------------------------------------------------------------- |
| Studio path | `GET /api/repeaterbook/export?region=na\|row&…`                                                      |
| Upstream    | `export.php` (NA) or `exportROW.php` (ROW) on `www.repeaterbook.com`                                 |
| Auth        | Per-user `X-RB-App-Token: rbuapp_…` forwarded browser → function → RepeaterBook only                 |
| User-Agent  | Set server-side in the Pages Function (approved string above)                                        |
| Origin gate | Shared allowlist with IRTS — see [build docs](../../../build/README.md#pages-functions-cors-bridges) |
| Local dev   | Vite `server.proxy` mirrors the path and injects User-Agent upstream                                 |

Deployed with the SPA via `wrangler.toml` + [`functions/api/repeaterbook/export.ts`](../../../functions/api/repeaterbook/export.ts) on every environment (dev / next / staging / prod).

## CORS (upstream)

Distributed-app approval covers programming integration; the edge proxy satisfies browser same-origin policy and User-Agent enforcement without storing operator tokens at the edge.

## Attribution

UI must credit: **Data courtesy of [RepeaterBook.com](https://www.repeaterbook.com/)**.

## Caching

Studio caches export responses in **sessionStorage** for up to **five minutes** per URL and token prefix — minimum necessary per RepeaterBook programming-integration policy. Identical search and verify queries within a tab reuse cached JSON without a second upstream call. See [repeater directories hub](../../../features/repeater-directories/README.md) and [adding a reference source](../../../features/repeater-directories/adding-reference-source.md).

## Related

- [repeater directories feature hub](../../../features/repeater-directories/README.md)
- [IRTS reference](../irts/README.md) — spike noted RepeaterBook ROW as future source
