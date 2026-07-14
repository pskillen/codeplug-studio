# Contact directories

Tier-1 reference for **DMR digital contact / ID directory** workflows — searching remote ID databases and importing private contacts into the vendor-neutral library.

**Tracking:** [#374](https://github.com/pskillen/codeplug-studio/issues/374) (epic, parent [#272](https://github.com/pskillen/codeplug-studio/issues/272)) · [#377](https://github.com/pskillen/codeplug-studio/issues/377)–[#379](https://github.com/pskillen/codeplug-studio/issues/379) · Anytone export [#376](https://github.com/pskillen/codeplug-studio/issues/376)

**Source:** `src/integrations/radioid/`, `src/app/components/contacts/`, `src/app/routes/library/AddFromRadioidPage.tsx`

## Problem

Many CPS suites (OpenGD77, qDMR, …) offer one-click DMR ID import. **Anytone CPS does not** — operators download CSV from e.g. RadioID.net and manually rewrite columns for `DMRDigitalContactList.CSV`. Studio fetches provider data at the integration boundary, stores enriched contacts in the library, and lets format exports project wire columns.

## Implementation status

| Area                                            | Status   | Notes                                                                                                    |
| ----------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------- |
| `DigitalContact` metadata model                 | Shipped  | [#377](https://github.com/pskillen/codeplug-studio/issues/377) — callsign, city, state, country, remarks |
| Digital contact CRUD UI                         | Shipped  | [#378](https://github.com/pskillen/codeplug-studio/issues/378) — editor + list columns                   |
| RadioID.net search + import                     | Shipped  | [#379](https://github.com/pskillen/codeplug-studio/issues/379) — `/library/contacts/add-from-radioid`    |
| Anytone `DMRDigitalContactList` metadata export | Shipped  | [#376](https://github.com/pskillen/codeplug-studio/issues/376)                                           |
| OpenGD77 / DM32 contact metadata export         | Deferred | Separate format tickets; model ready                                                                     |
| Additional ID providers                         | Deferred | One ticket per source after radioid.net                                                                  |

## Documentation map

| Doc                                                                      | Contents                          |
| ------------------------------------------------------------------------ | --------------------------------- |
| This README                                                              | Workflows, boundaries             |
| [contact-directories-progress.md](contact-directories-progress.md)       | Execution log                     |
| [contact-directories-outstanding.md](contact-directories-outstanding.md) | Follow-up debt                    |
| [radioid reference](../../reference/radioid/README.md)                   | API + proxy (tier 3)              |
| [digital-contacts reference](../../reference/digital-contacts.md)        | Internal field semantics (tier 2) |
| [library](../library/README.md)                                          | Contact CRUD                      |
| [import-export/anytone](../import-export/anytone/README.md)              | Anytone export consumer           |

## Workflows

| Workflow                    | Entry                                            | Behaviour                                                                                  |
| --------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| **Import from RadioID.net** | Library → Contacts → **Add from…** → RadioID.net | Search by DMR ID, callsign, city, state, or country; add row or bulk-add selected contacts |
| **Edit metadata**           | `/library/digital-contacts/:id`                  | Manual CRUD for all enriched fields                                                        |
| **Export to Anytone**       | Build export                                     | `DMRDigitalContactList.CSV` projects library metadata when present                         |

### Routes

- `/library/contacts/add-from-radioid`

## Architecture

- Provider HTTP client in `src/integrations/radioid/` — maps API rows → `DigitalContact` at boundary.
- CORS bridge: `GET /api/radioid/dmr/user` (Pages Function + Vite dev proxy) — see [radioid reference](../../reference/radioid/README.md).
- UUID `id` FKs internally; wire names only on format build export.
- Duplicate import gate: match on `digitalId` (not display `name`).
- Session cache (≤5 min) + per-provider rate-limit cooldown after HTTP 429.

## Related

- [repeater-directories](../repeater-directories/README.md) — sibling remote-import pattern for channels
- [RadioidContactSearch sidecar](../../src/app/components/contacts/RadioidContactSearch.md)
