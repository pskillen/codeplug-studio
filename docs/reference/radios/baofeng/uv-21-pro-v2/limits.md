# UV-21Pro V2 — limits

Shared hardware / memory caps. Adapters warn or truncate at the **export / write boundary** — library CRUD stays unlimited.

| Constraint | Value | Notes |
| --- | --- | --- |
| Max memory slots / channels | **1000** | CHIRP `UV21ProV2` / UV17Pro `CHANNELS=1000` |
| Channel name | **12** chars | Name shortening at export boundary |
| Zone / scan-list / contact / TG / RX-list organisation | N/A | Flat-memory radio — those entities unused |

Caps match CHIRP `UV21ProV2` / UV17Pro — see [enum-verification.md](../../../export-formats/chirp/enum-verification.md).

## Adapter application

| Adapter | Behaviour when over limit |
| --- | --- |
| CHIRP `chirp-uv21` | Warn; truncate lowest-priority rows if forced; `cps-verify` enforces caps |

See [capabilities.md](capabilities.md) for mode skip rules.
