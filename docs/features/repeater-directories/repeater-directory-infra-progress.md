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

## Shipped

- Shared `sessionStorage` cache (`sessionCache.ts`) with provider prefixes and ≤5 min TTL
- Per-provider 429 cooldown (`rateLimit.ts`) with `Retry-After` parsing
- `fetchDirectoryText` orchestration with stale-on-429 fallback
- ETCC, BrandMeister, IRTS, RepeaterBook clients wired
- [adding-reference-source.md](adding-reference-source.md) checklist
