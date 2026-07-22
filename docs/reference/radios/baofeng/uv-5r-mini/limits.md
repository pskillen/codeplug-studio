# UV-5R Mini — limits

Shared hardware / memory caps. Adapters warn or truncate at the **export / write boundary** — library CRUD stays unlimited.

| Constraint | Value | Notes |
| --- | --- | --- |
| Max memory slots / channels | **999** | CHIRP `CHANNELS=999`; NeonPlug `BAOFENG_CHANNEL_COUNT` |
| Channel name | **12** chars | Name shortening at export boundary |
| Zone / scan-list / contact / TG / RX-list organisation | N/A | Flat-memory radio — those entities unused |

Re-verified against CHIRP after UV-5R Mini cap fix ([#584](https://github.com/pskillen/codeplug-studio/issues/584) / [#602](https://github.com/pskillen/codeplug-studio/issues/602)).

## Adapter application

| Adapter | Behaviour when over limit |
| --- | --- |
| CHIRP `chirp-uv5r` | Warn; truncate lowest-priority rows if forced; `cps-verify` enforces caps |
| NeonPlug `neonplug-uv5rmini` | Export warnings from Studio profile constants |

See [capabilities.md](capabilities.md) for mode skip rules.
