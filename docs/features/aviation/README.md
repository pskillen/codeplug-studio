# Aviation — airport airband

Tier-1 reference for **airport airband monitoring** workflows — searching [OpenAIP](https://www.openaip.net/) for civil aviation frequencies and importing RX-only AM channels into the library, with optional Anytone `AMAir.CSV` export.

**Tracking:** [#262](https://github.com/pskillen/codeplug-studio/issues/262) · [#263](https://github.com/pskillen/codeplug-studio/issues/263) · [#264](https://github.com/pskillen/codeplug-studio/issues/264) · [#267](https://github.com/pskillen/codeplug-studio/issues/267) · [#268](https://github.com/pskillen/codeplug-studio/issues/268) · [progress](airband-openaip-progress.md) · [outstanding](airband-openaip-outstanding.md)

**Source:** `src/app/routes/library/AddFromOpenAipPage.tsx`, `src/app/components/aviation/`, `src/integrations/aviation/`, `src/core/domain/airband/`

**Related:** [repeater-directories](../repeater-directories/README.md) (directory search UX pattern) · [import-export/anytone](../import-export/anytone/README.md) (receive-only bank export)

## Implementation status

| Area | Status | Notes |
| --- | --- | --- |
| OpenAIP API client | Shipped | `src/integrations/aviation/` — [#263](https://github.com/pskillen/codeplug-studio/issues/263) |
| Airport search UI | Shipped | `/library/channels/add-from-openaip` |
| Settings API key | Shipped | Browser `localStorage` only |
| Core airband generation | Shipped | `src/core/domain/airband/` |
| System attributions | Planned | [#264](https://github.com/pskillen/codeplug-studio/issues/264) |
| Anytone `AMAir.CSV` export | Planned | [#267](https://github.com/pskillen/codeplug-studio/issues/267) |
| Anytone `FM.CSV` export | Planned | [#268](https://github.com/pskillen/codeplug-studio/issues/268) |

## Documentation map

| Doc | Contents |
| --- | --- |
| This README | Workflows, boundaries, code anchors |
| [OpenAIP API reference](../../reference/openaip/README.md) | Core API endpoints, field mapping (tier 3) |
| [library](../library/README.md) | Channel entity CRUD |
| [map](../map/README.md) | Embedded map on search results |
| [app-shell](../app-shell/README.md) | Routes and section nav |

## Workflow

| Step | Behaviour |
| --- | --- |
| Configure key | Settings → OpenAIP API key ([docs.openaip.net](https://docs.openaip.net/#/)) |
| Search | ICAO/IATA/name, town geocode, Maidenhead locator, or **Use my location** + radius (km) |
| Review | Map + per-airport frequency tables; select airports for batch import |
| Import | `buildAirbandImportPlan` → `putChannel` (+ optional `putZone` per airport) |
| Export | Anytone build with airband channels → `AMAir.CSV` ([#267](https://github.com/pskillen/codeplug-studio/issues/267)) |

**Route:** `/library/channels/add-from-openaip` — section nav **Add from OpenAIP**

## Principles

- Generated channels are normal library `Channel` rows — RX-only AM, `forbidTransmit: true`, `txFrequency: null`.
- OpenAIP wire shapes stay at the integration boundary (`AirportListing` → `AirbandAirportInput`); export partition is Anytone adapter only.
- Programming convenience only — not authoritative for aviation operations. Frequencies may change with AIP amendments.

## Data flow

```mermaid
flowchart LR
  API[OpenAIP Core API]
  Client[integrations/aviation]
  Listing[AirportListing]
  Gen[core/domain/airband]
  Plan[airbandImport]
  Lib[Library channels]
  API --> Client --> Listing --> Gen --> Plan --> Lib
```
