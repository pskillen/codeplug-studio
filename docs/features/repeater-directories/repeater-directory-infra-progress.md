# Repeater directory infra — progress

Execution log for [#73](https://github.com/pskillen/codeplug-studio/issues/73) session cache and [#341](https://github.com/pskillen/codeplug-studio/issues/341) 429 backoff.

## Commits

| Commit                                                                      | Slice                              |
| --------------------------------------------------------------------------- | ---------------------------------- |
| `feat(integrations): add shared repeater directory session cache`           | Shared sessionStorage cache module |
| `feat(integrations): add repeater directory rate limit cooldown`            | Rate-limit cooldown module         |
| `feat(integrations): add directory fetch with cache and rate limit`         | Directory fetch wrapper            |
| `feat(integrations): wire repeater clients to shared cache and rate limits` | Wire all provider clients          |
| `docs(repeater-directories): document session cache and rate limiting`      | Documentation + checklist          |
| `refactor(integrations): extract shared HTTP cache module`                  | `integrations/http` shared layer   |
| `feat(integrations): add Photon geocode session cache and rate limiting`    | Photon/Komoot geocode              |

## Shipped

- Shared `sessionStorage` cache ([`integrations/http/sessionCache.ts`](../../../src/integrations/http/sessionCache.ts)) with provider prefixes and ≤5 min TTL
- Per-provider 429 cooldown ([`integrations/http/rateLimit.ts`](../../../src/integrations/http/rateLimit.ts)) with `Retry-After` parsing
- `fetchCachedText` / `fetchDirectoryText` orchestration with stale-on-429 fallback
- ETCC, BrandMeister, IRTS, RepeaterBook clients wired
- Photon/Komoot forward + reverse geocode wired
- [adding-reference-source.md](adding-reference-source.md) checklist
