# RepeaterBook directory — outstanding

Debt and follow-ups discovered during [#274](https://github.com/pskillen/codeplug-studio/issues/274) execution.

## Live API spike

- [ ] Confirm browser CORS with operator `rbuapp_` token (distributed-app approval implies direct fetch; verify in devtools on first manual test)
- [ ] Confirm granted scopes: `api.export` (NA) and/or `api.export_row` (ROW)

## Deferred to shared infra

| #                                                              | Ticket               | Item                                          |
| -------------------------------------------------------------- | -------------------- | --------------------------------------------- |
| [#73](https://github.com/pskillen/codeplug-studio/issues/73)   | SessionStorage cache | Replace v1 in-memory cache with shared module |
| [#341](https://github.com/pskillen/codeplug-studio/issues/341) | 429 backoff          | Cooperative cooldown gate across providers    |

## Feature gaps (not blocking v1)

- GMRS `stype=gmrs` search UI
- Proximity / use-my-location (not documented on Export API)
- System attributions page entry ([#264](https://github.com/pskillen/codeplug-studio/issues/264))
