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

| Page                                                 | In the app                                                                                                                                                                                |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Index, IndexedDB, localStorage (and their sub-pages) | Works: the app's web view has the same storage                                                                                                                                            |
| UV-5R Mini full read                                 | Works: the read, the compare, the calibration view and **Download all**, which saves the zip to `Documents/Codeplug Studio/` and opens the share sheet                                    |
| AT-D890UV erase-unit probe                           | Only **Profile link speed (read-only)** runs. The passes that write, the diagnosis, the config-region alias check and the region exports show a "Not available in the Android app" notice |
| Serial reopen timing                                 | Shows a "Not available in the Android app" notice and no controls                                                                                                                         |

The app's web view has no `navigator.serial` (Web Serial). The two radio pages that run there open the app's USB
serial transport through the firmware flasher's seam (`grantFirmwareLinkPort` and `openFirmwareLinkPipe` in
`src/app/services/firmwarePort.ts`): the one attached device that matches the radio's USB IDs, never a picker; none,
or more than one, is refused with a message and nothing is sent. Android asks to allow USB access once per plug-in.

- **UV-5R Mini full read:** the radio report read's link, the same as the browser's: the CH340 (`1a86:7523`), 115200
  baud 8N1, DTR and RTS raised after the open, once more at 38400 when the handshake gets no answer. The read-only
  allowlist is the same code on both platforms.
- **AT-D890UV link speed:** the radio's own ST CDC port (`0483:5740`, the same ID in normal and update mode), 921600
  (nominal on USB CDC), DTR and RTS raised, as the browser opens it. `openAtD890ProbePipe`
  (`src/app/services/atD890ProbePort.ts`) refuses every other pass in the app before a port is requested. The link
  profile shows the sweep's per-frame round trip as median, p99 and max, summarised as the flasher summarises its
  frames, so a phone can be compared with a desktop before flashing from it.
- **Serial reopen timing** keeps `WebSerialOnlyDebugPage`, which shows the page title and the notice in the app and
  renders the page unchanged in a browser.

## Privacy

Data shown in Debug stays in the operator's browser and may include codeplug content or API tokens. Nothing is sent to a server. **Do not commit** screenshots or pasted exports from Debug pages.

Mapbox tokens are **masked** in the LocalStorage viewer (`••••` + last four characters).

## Routes

| Path                                          | Purpose                                                                                                                                                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/debug`                                      | Overview and privacy warning                                                                                                                                                                            |
| `/debug/indexed-db`                           | Object store row counts per project                                                                                                                                                                     |
| `/debug/indexed-db/:storeName`                | Rows in a store — channels show callsign; name, project id, and entity id are sortable and filterable                                                                                                   |
| `/debug/indexed-db/:storeName/:projectId/:id` | Single row JSON tree                                                                                                                                                                                    |
| `/debug/local-storage`                        | Known + discovered localStorage keys                                                                                                                                                                    |
| `/debug/local-storage/:storageKey`            | Parsed JSON for one key                                                                                                                                                                                 |
| `/debug/uv5r-mini`                            | UV-5R Mini read-only full clone read, span hashes, tab history, compare with a channel diff, and calibration viewer, in a browser and the Android app: [uv5r-mini-full-read.md](uv5r-mini-full-read.md) |

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
7. In the Android app, open Serial reopen timing → the "Not available in the Android app" notice and no controls.
8. In the Android app, open the AT-D890UV erase probe → the notice and only **Profile link speed (read-only)**; with the D890 on the phone's USB, the link profile shows median, p99 and max per frame.
9. In the Android app, open the UV-5R Mini full read with only the Mini's cable plugged in → **Full read** works; the reads compare and the calibration view shows; **Download all** saves the zip to `Documents/Codeplug Studio/` (the notice at the top says so) and opens the share sheet.

## Known gaps

- Neither radio page has been tried in the Android app on a phone with a radio.
- The storage pages are read-only: nothing edits or clears storage.
- There is no native YAML view: row YAML is the interim storage-row dump, waiting on native YAML export.

## Related

- [App shell](../app-shell/README.md) — navigation and route gating
- [Library](../library/README.md) — IndexedDB entity persistence
- [storage.md](../../poc-migration/storage.md) — persistence design
