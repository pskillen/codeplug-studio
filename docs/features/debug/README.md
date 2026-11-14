# Debug — browser storage inspection

Read-only contributor tooling to inspect **browser-local app state** without DevTools. Radio pages under `/debug` (the AT-D890UV erase probe, serial reopen timing, the [UV-5R Mini full read](uv5r-mini-full-read.md)) are contributor tools too. Useful for debugging CRUD persistence, multi-tab revision conflicts, list-prefs hydration, and storage quota.

**On prod:** the Debug pages, the avatar menu's Debug item and the Tools page's Debug section are hidden unless [developer mode](../developer-mode/README.md) is on for the device (tap the footer version five times). Every `/debug` route is mounted under `DebugGate` from `debugRoutes` in `src/app/routes/debug/debugRoutes.tsx`; add new pages there. The index page has a "Developer mode on this device" switch.

**Status:** Done · **Tracking:** [#54](https://github.com/pskillen/codeplug-studio/issues/54) (Phase 3 / Epic [#1](https://github.com/pskillen/codeplug-studio/issues/1))

**Source:** `src/integrations/debug/`, `src/app/routes/debug/`, `src/app/components/JsonTreeViewer/`

## Reaching the pages

The avatar (gear) menu's **Debug** item, and the **Debug** section at the foot of the Tools page (`/reference`), which
links the index and each page; the Android app has no URL bar. Both use the Debug icon, a terminal prompt
(`DEBUG_SECTION_ICON`, Tabler `IconTerminal2`, in `contextualStripItems.ts`), as does the Debug strip's Overview tab.

## In the Android app

| Page                                                                   | In the app                                                        |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Index, IndexedDB, localStorage (and their sub-pages)                   | Works: the app's web view has the same storage                    |
| AT-D890UV erase-unit probe, Serial reopen timing, UV-5R Mini full read | Shows a "Not available in the Android app" notice and no controls |

The three radio pages open their port through `navigator.serial` (Web Serial), which the app's web view does not
have, and do not use the app's USB serial transport. `WebSerialOnlyDebugPage` wraps each one: in the app it shows the
page title and the notice; in a browser it renders the page unchanged.

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

| Path                                          | Purpose                                                                                                                                                               |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/debug`                                      | Overview and privacy warning                                                                                                                                          |
| `/debug/indexed-db`                           | Object store row counts per project                                                                                                                                   |
| `/debug/indexed-db/:storeName`                | Rows in a store — channels show callsign; name, project id, and entity id are sortable and filterable                                                                 |
| `/debug/indexed-db/:storeName/:projectId/:id` | Single row JSON tree                                                                                                                                                  |
| `/debug/local-storage`                        | Known + discovered localStorage keys                                                                                                                                  |
| `/debug/local-storage/:storageKey`            | Parsed JSON for one key                                                                                                                                               |
| `/debug/uv5r-mini`                            | UV-5R Mini read-only full clone read, span hashes, tab history, compare with a channel diff, and calibration viewer: [uv5r-mini-full-read.md](uv5r-mini-full-read.md) |

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

| Layer            | Module                                                                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Integrations     | `src/integrations/debug/storageKeyRegistry.ts`, `indexedDbInspect.ts`, `parseStorageValue.ts`                                                       |
| List prefs keys  | `src/integrations/listPrefs/` (`LIST_PREFS_STORAGE_PREFIX`, `LIST_ENTITY_LABELS`)                                                                   |
| Preferences keys | `src/integrations/preferences/index.ts` (`ACTIVE_PROJECT_KEY`, `MAPBOX_TOKEN_KEY`)                                                                  |
| Routes           | `src/app/routes/debug/`                                                                                                                             |
| Tree viewer      | `src/app/components/JsonTreeViewer/JsonTreeViewer.tsx`                                                                                              |
| Navigation       | Avatar overflow → Debug and Tools → Debug (gated on prod); `debugStripItems`, `DEBUG_TOOL_LINKS`, `DEBUG_SECTION_ICON` in `contextualStripItems.ts` |
| Prod gate        | `DebugGate.tsx`, `debugRoutes.tsx`; `resolveDebugPagesGate` in `src/app/services/prodFeatureGate.ts`                                                |

## Manual verify

1. Open `/debug` — confirm privacy alert and tool links.
2. Create a project with channels → `/debug/indexed-db` shows non-zero `channels` count.
3. Drill into a channel row → JSON tree expands; Copy YAML works.
4. Set a Mapbox token in Settings → `/debug/local-storage` shows masked token in viewer.
5. Filter a library list → `/debug/local-storage` shows labelled list-prefs keys for the active project.
6. Open Tools (`/reference`) → the **Debug** section shows on pre-prod, and on prod with developer mode on; on prod with developer mode off it is absent.
7. In the Android app, open the AT-D890UV erase probe, Serial reopen timing and UV-5R Mini full read → each shows the "Not available in the Android app" notice and no controls.

## Related

- [App shell](../app-shell/README.md) — navigation and route gating
- [Library](../library/README.md) — IndexedDB entity persistence
- [storage.md](../../poc-migration/storage.md) — persistence design
