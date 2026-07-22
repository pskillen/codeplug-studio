# RT95 VOX — limits

Shared hardware / memory caps. Adapters warn or truncate at the **export / write boundary** — library CRUD stays unlimited.

| Constraint | Value | Notes |
| --- | --- | --- |
| Max memory slots / channels | **200** | CHIRP `memory_bounds=(1, 200)` |
| Channel name | **6** chars | Tightest CHIRP profile in Studio; shortening at export |
| Zone / scan-list / contact / TG / RX-list organisation | N/A | Flat-memory radio — those entities unused |

Caps match CHIRP `RetevisRT95vox` — see [enum-verification.md](../../../export-formats/chirp/enum-verification.md).

## Adapter application

| Adapter | Behaviour when over limit |
| --- | --- |
| CHIRP `chirp-rt95` | Warn when channel count exceeds; truncate lowest-priority rows if forced; `cps-verify` enforces memory-slot and name-length caps |

See [capabilities.md](capabilities.md) for mode skip rules.
