# Library CRUD

Tier-1 reference for editing the vendor-neutral **library** — the per-project inventory of channels, talk groups, contacts, RX group lists, and zones.

**Tracking:** Phase 2 [#10](https://github.com/pskillen/codeplug-studio/issues/10) (persistence: [#9](https://github.com/pskillen/codeplug-studio/issues/9), Epic [#1](https://github.com/pskillen/codeplug-studio/issues/1)); list routes [#20](https://github.com/pskillen/codeplug-studio/issues/20), channels table [#24](https://github.com/pskillen/codeplug-studio/issues/24), zone picker [#25](https://github.com/pskillen/codeplug-studio/issues/25)

**Source:** `src/app/routes/library/`, `src/app/state/` (`useLibrary`, `libraryService`), `src/core/domain/references.ts`

## List routes

`/library` redirects to `/library/channels`. Each entity kind has a dedicated list page; section nav order matches `routes/library/nav.ts`:

| List route                | UI                                                                                                           | Map |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ | --- |
| `/library/channels`       | `DataTable` — sortable columns, toolbar search, hideable optional columns, URL + `localStorage` filter prefs | Yes |
| `/library/zones`          | Card rows via `LibraryEntityList`                                                                            | Yes |
| `/library/talk-groups`    | Card rows                                                                                                    | No  |
| `/library/contacts`       | Two sections: digital contacts + analog contacts                                                             | No  |
| `/library/rx-group-lists` | Card rows                                                                                                    | No  |

### Channels list (#24)

- Filters in section nav: name/callsign search, band, mode, simplex/split, distance radius (when operator location is set).
- Filter state syncs to URL query params and per-project `localStorage`.
- Column sort and visibility prefs persist per project.
- `modeProfiles[]` drives mode pills and mode filter matching (vendor-neutral labels only).

### Contacts page

Digital and analog contacts remain separate models and editor slugs (`digital-contacts`, `analog-contacts`); the combined `/library/contacts` list page is a UX grouping only.

### Zone member picker (#25)

Zone editor uses `ZoneMemberPicker` — available ↔ in-zone lists with per-side search, add/remove, and move up/down. Saved `Zone.members` preserves **picker order** as `{ kind: 'channel', id }[]`.

## Editor routes

| Path                 | Purpose                                  |
| -------------------- | ---------------------------------------- |
| `/library/:kind/:id` | Edit an entity (`:id` = `new` to create) |

`:kind` is a slug (`channels`, `talk-groups`, `digital-contacts`, `analog-contacts`, `rx-group-lists`, `zones`) mapped to an internal `EntityKind` in `routes/library/registry.ts`. Editors navigate back to the matching list route on save/cancel via `listPathForEditorSlug()`.

## Entities and editors

| Entity          | Key fields                                                                       |
| --------------- | -------------------------------------------------------------------------------- |
| Channel         | name, callsign, RX/TX (MHz↔Hz), power, scan-skip, comment, FM **or** DMR profile |
| Talk group      | name, digital mode, group ID, comment                                            |
| Digital contact | name, digital mode, contact ID, comment                                          |
| Analog contact  | name, code, comment                                                              |
| RX group list   | name, members (talk groups / digital contacts)                                   |
| Zone            | name, ordered channel members, export flags, scan carrier frequency, comment     |

Channel DMR profiles reference a **digital contact** and an **RX group list** by UUID `id` (the editor exposes dropdowns); RX group lists and zones hold member `EntityRef[]`. Names are display labels only — never foreign keys.

## Data flow

```text
Editor → persistence.put<Entity>(row, expectedRevision)  // optimistic concurrency
list   ← useLibrary() → LibraryService.loadLibrary(projectId)
change → persistence.subscribe(...) → useLibrary refresh (this tab + other tabs)
delete → LibraryService.deleteWithIntegrity → findReferencesTo (core)
```

- **Optimistic concurrency:** editors save with the loaded `revision`; a stale write returns `revision_conflict` and the editor shows a reload-and-retry message.
- **Referential integrity:** deletes are **blocked** when another entity still references the target (e.g. a zone listing a channel, an RX group list listing a talk group, a channel DMR profile pointing at a contact / RX list). The block lists the referencing entities.

## Boundaries

- Vendor-neutral: no radio caps, format strings, or CSV concepts. Cardinality/limits and **CPS wire names** belong on the **format build** (`FormatBuild` selections and overrides), not here.
- `core` holds pure domain + integrity (`references.ts`); persistence orchestration lives in the app layer (`LibraryService`), never in `core`.

## Library vs format build

The library holds RF facts you curate once (frequency, mode, contact refs, human-readable names). When you export to a specific radio, a persisted **`FormatBuild`** maps those entities to that CPS workflow — trait layout, which rows participate, and **wire-name overrides** (including shortened names for 16-character limits or m×n expansion). Export always uses **both** layers; see [data-model — Two persisted layers](../data-model/README.md#two-persisted-layers-not-one-export-format).

## Related

- [app-shell/library-routes-progress.md](../app-shell/library-routes-progress.md) · [app-shell/library-routes-outstanding.md](../app-shell/library-routes-outstanding.md)
- [map](../map/README.md) — map on channels/zones list routes
- [data-model](../data-model/README.md) · [app-shell](../app-shell/README.md)
- [storage.md](../../poc-migration/storage.md) — persistence design
