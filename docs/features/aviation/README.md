# Aviation — airport airband

Tier-1 reference for **airport airband monitoring** workflows — searching [OpenAIP](https://www.openaip.net/) for civil aviation frequencies and importing RX-only AM channels into the library, with optional Anytone `AMAir.CSV` export.

**Tracking:** [#262](https://github.com/pskillen/codeplug-studio/issues/262) · [progress](airband-openaip-progress.md) · [outstanding](airband-openaip-outstanding.md)

**Related:** [repeater-directories](../repeater-directories/README.md) (directory search UX pattern) · [import-export/anytone](../import-export/anytone/README.md) (receive-only bank export)

## Implementation status

| Area | Status | Notes |
| --- | --- | --- |
| OpenAIP API client | Planned | `src/integrations/aviation/` |
| Airport search UI | Planned | `/library/channels/add-from-openaip` |
| Settings API key | Planned | Browser `localStorage` only |
| Core airband generation | Planned | `src/core/domain/airband/` |
| System attributions | Planned | [#264](https://github.com/pskillen/codeplug-studio/issues/264) |
| Anytone `AMAir.CSV` export | Planned | [#267](https://github.com/pskillen/codeplug-studio/issues/267) |
| Anytone `FM.CSV` export | Planned | [#268](https://github.com/pskillen/codeplug-studio/issues/268) |

## Principles

- Generated channels are normal library `Channel` rows — RX-only AM, `forbidTransmit: true`.
- OpenAIP wire shapes stay at the integration boundary; export partition is Anytone adapter only.
- Programming convenience only — not authoritative for aviation operations.
