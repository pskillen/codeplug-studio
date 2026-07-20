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
| Delete all digital contacts                     | Shipped  | [#427](https://github.com/pskillen/codeplug-studio/issues/427) — checkbox-gated wipe after huge imports; cascade-clears channel/`RX` refs                                                                      |
| Anytone `DMRDigitalContactList` metadata export | Shipped  | [#376](https://github.com/pskillen/codeplug-studio/issues/376)                                                                                                                                                 |
| OpenGD77 / DM32 contact metadata export         | Deferred | Separate format tickets; model ready                                                                                                                                                                           |
| Additional ID providers                         | Deferred | One ticket per source after radioid.net                                                                                                                                                                        |
| IndexedDB-primary contact browsing              | Deferred | [#428](https://github.com/pskillen/codeplug-studio/issues/428) — investigation; complements [#387](https://github.com/pskillen/codeplug-studio/issues/387) YAML split                                          |

## Documentation map

| Doc                                                               | Contents                          |
| ----------------------------------------------------------------- | --------------------------------- |
| This README                                                       | Workflows, boundaries             |
| [radioid reference](../../reference/radioid/README.md)            | API + proxy (tier 3)              |
| [digital-contacts reference](../../reference/digital-contacts.md) | Internal field semantics (tier 2) |
| [library](../library/README.md)                                   | Contact CRUD                      |
| [import-export/anytone](../import-export/anytone/README.md)       | Anytone export consumer           |

Shipped core path — remaining scale work under epic [#374](https://github.com/pskillen/codeplug-studio/issues/374).

## Workflows

| Workflow                    | Entry                                            | Behaviour                                                                                                                                                                                |
| --------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Import from RadioID.net** | Library → Contacts → **Add from…** → RadioID.net | Search by country → callsign/ID; bulk **Add all results** (paginated), **Add this page**, or **Add selected** via confirm/progress modal; preview/update when contact already in library |
| **Update from directory**   | Search results **Update** or contact editor      | Field-level diff vs RadioID.net listing (`RadioidContactUpdateDialog`)                                                                                                                   |
| **Edit metadata**           | `/library/digital-contacts/:id`                  | Manual CRUD for all enriched fields                                                                                                                                                      |
| **Delete all digital**      | Library → Contacts → **Delete all**              | Checkbox-gated modal; cascade-clears channel/`RX` refs then wipes the digital contact store ([#427](https://github.com/pskillen/codeplug-studio/issues/427))                             |
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
- **Delete all recovery:** when a huge import leaves the tab unusable, **Delete all** clears the digital contact partition via `deleteDigitalContactsForProject` (IDB key cursor — no full hydrate for delete) after cascade-clearing refs. This is a stopgap until IndexedDB-primary browsing ([#428](https://github.com/pskillen/codeplug-studio/issues/428)).
- Session cache (≤5 min) + per-provider rate-limit cooldown after HTTP 429.

## Related

- [repeater-directories](../repeater-directories/README.md) — sibling remote-import pattern for channels
- [RadioidContactSearch sidecar](../../src/app/components/contacts/RadioidContactSearch.md)
- [DeleteAllDigitalContactsDialog sidecar](../../src/app/components/contacts/DeleteAllDigitalContactsDialog.md)
