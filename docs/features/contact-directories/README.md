# Contact directories

Tier-1 reference for **DMR digital contact / ID directory** workflows — searching remote ID databases and importing private contacts into the vendor-neutral library.

**Tracking:** [#374](https://github.com/pskillen/codeplug-studio/issues/374) (epic, parent [#272](https://github.com/pskillen/codeplug-studio/issues/272)) · [#377](https://github.com/pskillen/codeplug-studio/issues/377)–[#379](https://github.com/pskillen/codeplug-studio/issues/379) · Anytone export [#376](https://github.com/pskillen/codeplug-studio/issues/376)

**Source:** `src/integrations/radioid/`, `src/app/components/contacts/`, `src/app/routes/library/AddFromRadioidPage.tsx`

## Problem

Many CPS suites (OpenGD77, qDMR, …) offer one-click DMR ID import. **Anytone CPS does not** — operators download CSV from e.g. RadioID.net and manually rewrite columns for `DMRDigitalContactList.CSV`. Studio fetches provider data at the integration boundary, stores enriched contacts in the library, and lets format exports project wire columns.

## Implementation status

| Area                                            | Status   | Notes                                                                                                                                                                                                          |
| ----------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DigitalContact` metadata model                 | Shipped  | [#377](https://github.com/pskillen/codeplug-studio/issues/377) — callsign, city, state, country, remarks                                                                                                       |
| Digital contact CRUD UI                         | Shipped  | [#378](https://github.com/pskillen/codeplug-studio/issues/378) — editor + list columns                                                                                                                         |
| RadioID.net search + import                     | Shipped  | [#379](https://github.com/pskillen/codeplug-studio/issues/379) — bulk add, update/compare, preview modal; [#385](https://github.com/pskillen/codeplug-studio/issues/385) batched persistence for large imports |
| RadioID.net update on contact editor            | Shipped  | `RadioidContactVerifyPanel` on digital contact editor                                                                                                                                                          |
| Anytone `DMRDigitalContactList` metadata export | Shipped  | [#376](https://github.com/pskillen/codeplug-studio/issues/376)                                                                                                                                                 |
| OpenGD77 / DM32 contact metadata export         | Deferred | Separate format tickets; model ready                                                                                                                                                                           |
| Additional ID providers                         | Deferred | One ticket per source after radioid.net                                                                                                                                                                        |

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

| Workflow                    | Entry                                            | Behaviour                                                                                                                                                                                |
| --------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Import from RadioID.net** | Library → Contacts → **Add from…** → RadioID.net | Search by country → callsign/ID; bulk **Add all results** (paginated), **Add this page**, or **Add selected** via confirm/progress modal; preview/update when contact already in library |
| **Update from directory**   | Search results **Update** or contact editor      | Field-level diff vs RadioID.net listing (`RadioidContactUpdateDialog`)                                                                                                                   |
| **Edit metadata**           | `/library/digital-contacts/:id`                  | Manual CRUD for all enriched fields                                                                                                                                                      |
| **Export to Anytone**       | Build export                                     | `DMRDigitalContactList.CSV` projects library metadata; **Contact export name style** on Build → Contacts or Export chooses how `Name` is composed (`name`, `callsign`, `callsign-name`)  |

### Routes

- `/library/contacts/add-from-radioid`

## Architecture

- Provider HTTP client in `src/integrations/radioid/` — maps API rows → `DigitalContact` at boundary.
- CORS bridge: `GET /api/radioid/dmr/user/` (trailing slash required; Pages Function + Vite dev proxy) — see [radioid reference](../../reference/radioid/README.md).
- UUID `id` FKs internally; wire names only on format build export.
- **Contact export name style** is an export-time build setting (not import-time): library stores `name` and `callsign` separately; Anytone/OpenGD77 export composes CPS `Name` per `exportSettings.digitalContactExportNameMode`.
- Duplicate import gate: match on `digitalId` (not display `name`).
- **Bulk import persistence:** **Add all results** writes contacts in batched IndexedDB transactions (one batch per RadioID.net results page, up to 100 rows) inside `runWithoutNotifications` so the library reloads once when import completes — suitable for country-scale imports (10k+ IDs).
- Session cache (≤5 min) + per-provider rate-limit cooldown after HTTP 429.

## Related

- [repeater-directories](../repeater-directories/README.md) — sibling remote-import pattern for channels
- [RadioidContactSearch sidecar](../../src/app/components/contacts/RadioidContactSearch.md)
