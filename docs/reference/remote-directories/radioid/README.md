# RadioID.net reference

Authoritative reference for the **RadioID.net** DMR user API used by Codeplug Studio for private contact directory import.

This is a **remote directory API**, not a CPS wire format. HTTP proxy, JSON parse, and normalisation live in [`src/integrations/radioid/`](../../../../src/integrations/radioid/). Feature behaviour: [contact directories](../../../features/contact-directories/README.md).

## Source

| Property           | Value                                                                                                |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| Publisher          | [RadioID.net](https://www.radioid.net/)                                                              |
| Human search       | `https://database.radioid.net/database/search`                                                       |
| API docs           | `https://radioid.net/api/`                                                                           |
| DMR users endpoint | `GET /api/dmr/user/`                                                                                 |
| Licence            | Public read-only API; respect [acceptable use policy](https://www.radioid.net/acceptable_use_policy) |
| Geographic scope   | Worldwide DMR users                                                                                  |

## CORS bridge (Studio)

RadioID.net does **not** send `Access-Control-Allow-Origin` for browser direct fetch.

Studio exposes a same-origin Pages Function:

| Property    | Value                                                                                    |
| ----------- | ---------------------------------------------------------------------------------------- |
| Studio path | `GET /api/radioid/dmr/user/` (trailing slash required)                                   |
| Upstream    | `https://database.radioid.net/api/dmr/user/`                                             |
| Auth        | None (public upstream)                                                                   |
| Cache       | `Cache-Control: public, max-age=300`                                                     |
| Origin gate | Shared allowlist with RepeaterBook / IRTS — deploy hostnames and `http://localhost:5173` |
| Local dev   | Vite `server.proxy` rewrites `/api/radioid` → `/api` on `database.radioid.net`           |

Deployed via `functions/api/radioid/dmr/user.ts` on every Cloudflare Pages environment.

## Query parameters (DMR users)

Studio forwards these query params to upstream (see [API explorer](https://radioid.net/api/) for full list):

| Param                      | Use                            |
| -------------------------- | ------------------------------ |
| `id`                       | DMR radio ID                   |
| `id_sel`                   | `=` or `B`                     |
| `callsign`                 | Amateur callsign               |
| `callsign_sel`             | `=`, `L`, `B`, `E`             |
| `city`, `state`, `country` | Location filters               |
| `*_sel`                    | Match mode for string filters  |
| `page`                     | Page number (starts at 1)      |
| `per_page`                 | Page size (Studio caps at 100) |

## Response shape (JSON)

```json
{
  "count": 1,
  "page": 1,
  "pages": 1,
  "per_page": 1,
  "results": [
    {
      "id": 3109478,
      "callsign": "W1AW",
      "fname": "Hiram",
      "surname": "",
      "name": "Hiram",
      "city": "Newington",
      "state": "Connecticut",
      "country": "United States"
    }
  ]
}
```

Additional fields (`lastheard`, `radio_id`, …) are ignored at the integration boundary.

## Mapping → `DigitalContact`

| API field                                 | Internal field              |
| ----------------------------------------- | --------------------------- |
| `id`                                      | `digitalId`                 |
| `callsign`                                | `callsign`                  |
| `fname` + `surname` (fallback `callsign`) | `name`                      |
| `city`                                    | `city`                      |
| `state`                                   | `state`                     |
| `country`                                 | `country`                   |
| _(fixed)_                                 | `mode` = `dmr`              |
| _(default)_                               | `remarks`, `comment` = `''` |

Internal model semantics: [digital-contacts.md](../../digital-contacts.md).

Anytone wire projection: [anytone/talk-groups.md](../../formats/anytone/talk-groups.md) (`DMRDigitalContactList.CSV`).

## Rate limits

RadioID.net may return HTTP 429 when requests are excessive. Studio:

- Records per-provider cooldown (honours `Retry-After` when present).
- Serves stale session-cached results on 429 when available.
- Does not auto-retry search requests.

## Related

- [contact directories feature hub](../../../features/contact-directories/README.md)
- [IRTS repeater reference](../irts/README.md) — sibling CORS proxy pattern
