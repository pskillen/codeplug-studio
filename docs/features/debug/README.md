# Debug — browser storage inspection

Read-only contributor tooling to inspect **browser-local app state** without DevTools. Useful for debugging CRUD persistence, multi-tab revision conflicts, list-prefs hydration, and storage quota.

**Tracking:** [#54](https://github.com/pskillen/codeplug-studio/issues/54) (Phase 3 / Epic [#1](https://github.com/pskillen/codeplug-studio/issues/1))

**Source:** `src/integrations/debug/`, `src/app/routes/debug/`, `src/app/components/JsonTreeViewer/`

## Privacy

Data shown in Debug stays in the operator's browser and may include codeplug content or API tokens. Nothing is sent to a server. **Do not commit** screenshots or pasted exports from Debug pages.

Mapbox tokens are **masked** in the LocalStorage viewer (`••••` + last four characters).

## Implementation status

| Area                | Status   | Notes                                                  |
| ------------------- | -------- | ------------------------------------------------------ |
| Debug landing       | Shipped  | `/debug` — intro + tool links                          |
| IndexedDB inspector | Shipped  | Store summaries, row drill-down, JSON tree + Copy YAML |
| LocalStorage index  | Shipped  | Known keys + prefix catch-all                          |
| Edit/clear storage  | Deferred | Read-only in v1                                        |
| Native YAML view    | Deferred | Blocked on native YAML export ticket                   |

## Routes

| Path                                          | Purpose                                                                                               |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `/debug`                                      | Overview and privacy warning                                                                          |
| `/debug/indexed-db`                           | Object store row counts per project                                                                   |
| `/debug/indexed-db/:storeName`                | Rows in a store — channels show callsign; name, project id, and entity id are sortable and filterable |
| `/debug/indexed-db/:storeName/:projectId/:id` | Single row JSON tree                                                                                  |
| `/debug/local-storage`                        | Known + discovered localStorage keys                                                                  |
| `/debug/local-storage/:storageKey`            | Parsed JSON for one key                                                                               |

Routes do **not** require an active project (same class as Settings and Reference).

## Storage keys

### IndexedDB (`codeplug-studio`)

Per-entity object stores — see [storage.md](../../poc-migration/storage.md):

| Store             | Entity kind          |
| ----------------- | -------------------- |
| `projects`        | Project metadata     |
| `channels`        | Library channels     |
| `zones`           | Library zones        |
| `talkGroups`      | Talk groups          |
| `digitalContacts` | Digital contacts     |
| `analogContacts`  | Analog contacts      |
| `rxGroupLists`    | RX group lists       |
| `formatBuilds`    | Format build records |

IndexedDB row YAML copy is labelled **storage rows as YAML** — interim JSON dump, not native interchange.

### localStorage

| Key / prefix                      | Purpose                                           | Redact  |
| --------------------------------- | ------------------------------------------------- | ------- |
| `codeplug-studio:activeProjectId` | Last selected project id                          | No      |
| `codeplug-studio:mapboxToken`     | Mapbox API token                                  | **Yes** |
| `codeplug-studio:*` (other)       | Future prefs — shown as "Preferences (unknown)"   | No      |
| `mm9pdy-codeplug-studio.list.*`   | List filters, sort, column visibility per project | No      |

List-prefs keys follow `mm9pdy-codeplug-studio.list.{entity}.{projectId}` with optional `.columns` / `.columns-schema` suffixes. Entity labels for the debug index come from `LIST_ENTITY_LABELS` in [`src/integrations/listPrefs/constants.ts`](../../../src/integrations/listPrefs/constants.ts) (shared with [`storageKeyRegistry.ts`](../../../src/integrations/debug/storageKeyRegistry.ts) — no duplicated prefix in app).

## Code anchors

| Layer            | Module                                                                                        |
| ---------------- | --------------------------------------------------------------------------------------------- |
| Integrations     | `src/integrations/debug/storageKeyRegistry.ts`, `indexedDbInspect.ts`, `parseStorageValue.ts` |
| List prefs keys  | `src/integrations/listPrefs/` (`LIST_PREFS_STORAGE_PREFIX`, `LIST_ENTITY_LABELS`)             |
| Preferences keys | `src/integrations/preferences/index.ts` (`ACTIVE_PROJECT_KEY`, `MAPBOX_TOKEN_KEY`)            |
| Routes           | `src/app/routes/debug/`                                                                       |
| Tree viewer      | `src/app/components/JsonTreeViewer/JsonTreeViewer.tsx`                                        |
| Navigation       | `AppNav`, `DebugSectionNav`, `sectionNavRegistry.ts`                                          |

## Manual verify

1. Open `/#/debug` — confirm privacy alert and tool links.
2. Create a project with channels → `/#/debug/indexed-db` shows non-zero `channels` count.
3. Drill into a channel row → JSON tree expands; Copy YAML works.
4. Set a Mapbox token in Settings → `/#/debug/local-storage` shows masked token in viewer.
5. Filter a library list → `/#/debug/local-storage` shows labelled list-prefs keys for the active project.

## Related

- [App shell](../app-shell/README.md) — navigation and route gating
- [Library](../library/README.md) — IndexedDB entity persistence
- [storage.md](../../poc-migration/storage.md) — persistence design
