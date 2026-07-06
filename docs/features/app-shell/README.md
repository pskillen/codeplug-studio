# App shell & project lifecycle

Tier-1 reference for the Phase 2 application shell: navigation chrome, route surfaces, and the project lifecycle (create blank project, switch, rename, delete).

**Tracking:** Phase 2 [#8](https://github.com/pskillen/codeplug-studio/issues/8) (Epic [#1](https://github.com/pskillen/codeplug-studio/issues/1)); library list routes [#20](https://github.com/pskillen/codeplug-studio/issues/20); GitHub feedback links [#70](https://github.com/pskillen/codeplug-studio/issues/70)

**Source:** `src/app/`

## Overview

The SPA uses Mantine `AppShell` with two-section navigation (primary + section nav), matching the codeplug-tool UI kit. `ProjectProvider` supplies project state via `useProjects()`. Visible product title: **MM9PDY Codeplug Studio**.

```text
ProjectProvider
└─ OperatorPositionProvider
   └─ BrowserRouter
      └─ AppLayout (AppShell: header + AppNav + SectionNav + Outlet + footer)
         ├─ /          Projects (lifecycle UI)
         ├─ /library/* Per-entity library list routes (see library docs)
         ├─ /import-export Native YAML import/export (active project)
         ├─ /summary   Library summary
         ├─ /map       _(redirect → /library/channels)_
         ├─ /reference Reference tools
         ├─ /debug     Storage inspectors (IndexedDB + localStorage)
         ├─ /settings  Settings shell
         └─ /help      Help shell
```

## Documentation map

| Doc                                                                                 | Contents                                          |
| ----------------------------------------------------------------------------------- | ------------------------------------------------- |
| [data-table.md](data-table.md)                                                      | `DataTable`, list prefs, entity list hooks        |
| [alerts.md](alerts.md)                                                              | Mantine `Alert` colour conventions                |
| [GradientSegmentedControl](../../src/app/components/ui/GradientSegmentedControl.md) | Per-segment indicator colours with fade on change |
| [SelectedItemList](../../src/app/components/ui/SelectedItemList.md)                 | Ordered selected-member list shell                |
| [AvailableItemPicker](../../src/app/components/ui/AvailableItemPicker.md)           | Sectioned pool picker shell                       |
| [PillTabs](../../src/app/components/ui/PillTabs.md)                                 | Tabs with optional leading pill/badge in labels   |
| [library-routes-progress.md](library-routes-progress.md)                            | Library routes initiative — shipped slices        |
| [library-routes-outstanding.md](library-routes-outstanding.md)                      | Deferred debt from library routes PR              |
| [library/README.md](../library/README.md)                                           | Library CRUD and list routes                      |
| [map/README.md](../map/README.md)                                                   | Embedded channel map                              |

UI primitives live in `src/app/components/ui/` (ported from codeplug-tool). Reusable list infrastructure is documented in [data-table.md](data-table.md). Inline feedback uses Mantine `Alert` — see [alerts.md](alerts.md). Dev styleguide: `/styleguide` (unlinked).

## Routes

| Path                                          | Surface                 | Status                                                                                                                                                                   |
| --------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/`                                           | Projects                | Lifecycle UI (create/switch/rename/delete) + **Import from YAML** ([#60](https://github.com/pskillen/codeplug-studio/issues/60))                                         |
| `/library`                                    | _(redirect)_            | → `/library/channels`                                                                                                                                                    |
| `/library/channels`                           | Channels list           | DataTable + filters + map — [#20](https://github.com/pskillen/codeplug-studio/issues/20), [#24](https://github.com/pskillen/codeplug-studio/issues/24)                   |
| `/library/zones`                              | Zones list              | DataTable + map — [#20](https://github.com/pskillen/codeplug-studio/issues/20)                                                                                           |
| `/library/talk-groups`                        | Talk groups list        | DataTable — [#20](https://github.com/pskillen/codeplug-studio/issues/20)                                                                                                 |
| `/library/contacts`                           | Contacts list           | Digital + analog DataTables — [#20](https://github.com/pskillen/codeplug-studio/issues/20)                                                                               |
| `/library/rx-group-lists`                     | RX group lists list     | DataTable — [#20](https://github.com/pskillen/codeplug-studio/issues/20)                                                                                                 |
| `/library/:kind/:id`                          | Entity editor           | CRUD forms — [#10](https://github.com/pskillen/codeplug-studio/issues/10)                                                                                                |
| `/import-export`                              | Import / export         | Native YAML export + replace import — [#59](https://github.com/pskillen/codeplug-studio/issues/59), [#60](https://github.com/pskillen/codeplug-studio/issues/60)         |
| `/library/channels/add-from-ukrepeater`       | Add from ukrepeater.net | [repeater-directories](../repeater-directories/README.md)                                                                                                                |
| `/library/channels/add-from-brandmeister`     | Add from BrandMeister   | [repeater-directories](../repeater-directories/README.md)                                                                                                                |
| `/map`                                        | _(redirect)_            | → `/library/channels` (legacy [#11](https://github.com/pskillen/codeplug-studio/issues/11))                                                                              |
| `/summary`                                    | Summary                 | [Library summary](../report/README.md) — Ticket #12                                                                                                                      |
| `/reports`                                    | _(redirect)_            | Redirects to `/summary` (legacy route)                                                                                                                                   |
| `/reference`                                  | Reference hub           | Choose Maidenhead or Bands from section nav — [#29](https://github.com/pskillen/codeplug-studio/issues/29), [#30](https://github.com/pskillen/codeplug-studio/issues/30) |
| `/reference/maidenhead`                       | Maidenhead converter    | [maidenhead.md](../maidenhead.md) — map, geocode, channel lookup                                                                                                         |
| `/reference/bands`                            | Band plan               | [bands.md](../../reference/bands.md) — grouped pills table                                                                                                               |
| `/settings`                                   | Settings                | Shell content                                                                                                                                                            |
| `/debug`                                      | Debug hub               | [debug](../debug/README.md) — IndexedDB + localStorage inspectors ([#54](https://github.com/pskillen/codeplug-studio/issues/54))                                         |
| `/debug/indexed-db`                           | IndexedDB stores        | Row counts and per-entity drill-down                                                                                                                                     |
| `/debug/indexed-db/:storeName`                | IndexedDB store rows    | Links to row viewer                                                                                                                                                      |
| `/debug/indexed-db/:storeName/:projectId/:id` | IndexedDB row viewer    | JSON tree + Copy YAML                                                                                                                                                    |
| `/debug/local-storage`                        | LocalStorage keys       | Known keys + `codeplug-studio:` / `mm9pdy-codeplug-studio.` prefix scan                                                                                                  |
| `/debug/local-storage/:storageKey`            | LocalStorage viewer     | Parsed JSON (tokens masked)                                                                                                                                              |
| `/help`                                       | Help                    | Workflow overview + GitHub Issues guidance ([#70](https://github.com/pskillen/codeplug-studio/issues/70))                                                                |
| `/styleguide`                                 | Styleguide              | Hidden dev page (UI kit demos)                                                                                                                                           |

Routes that need a project gate on an active project and link back to Projects when none is selected.

## Section navigation

Library list routes each have a dedicated section-nav entry (longest-prefix match in `sectionNavRegistry.ts`). Shared entity links come from `routes/library/nav.ts` inside `LibrarySectionNavFrame` (entity links → divider → route-specific controls). Contextual **New …** actions vary per route (e.g. contacts: New digital + New analog; channels: repeater import buttons + filters).

## Project lifecycle

State flows through a thin app-state adapter, `ProjectStore` (`src/app/state/projectStore.ts`), over the `ProjectPersistence` port:

| Operation | Behaviour                                                                         |
| --------- | --------------------------------------------------------------------------------- |
| Create    | `newProjectMeta` + empty library seeded; becomes active                           |
| List      | Sorted by name from the port                                                      |
| Switch    | Sets the active project id (persisted to `localStorage`)                          |
| Rename    | Loads meta, `putProjectMeta` with optimistic revision                             |
| Delete    | Cascades all project, library, and format-build rows; clears active id if deleted |

## Persistence note

Projects and library rows persist durably in the browser via IndexedDB (Ticket [#9](https://github.com/pskillen/codeplug-studio/issues/9)): one row per entity, optimistic `revision` concurrency, and `BroadcastChannel` cross-tab notifications. A shared singleton (`src/app/state/persistence.ts`) backs the whole app. See [storage.md](../../poc-migration/storage.md) and [library](../library/README.md).

The **active-project selection** is remembered across reloads via `localStorage` (`src/integrations/preferences/`), reconciled against the loaded project list on startup. Channel list filter prefs, entity list name/sort prefs, and channel column visibility use per-project `localStorage` keys under `mm9pdy-codeplug-studio.list.*` — see [data-table.md](data-table.md).

## Footer and feedback links

Every routed page renders [`BuildFooter`](../../../src/app/components/BuildFooter/BuildFooter.tsx) below the main `Outlet`. The footer shows build env/version plus muted **Repository** and **Report a bug** links (shared URLs in `src/app/lib/githubLinks.ts`).

The **Help** route adds a **Feedback** section with the same repo/issues URLs and short guidance for filing GitHub Issues.

| Area                  | Status  | Notes                                                        |
| --------------------- | ------- | ------------------------------------------------------------ |
| Global footer links   | Shipped | [#70](https://github.com/pskillen/codeplug-studio/issues/70) |
| Help feedback section | Shipped | [#70](https://github.com/pskillen/codeplug-studio/issues/70) |

## Boundaries

- App layer only (`src/app/`); calls `core` factories and the `integrations` persistence port — never low-level mutations ad hoc.
- Vendor-neutral: no format strings, radio caps, or CSV concepts in the shell.

## Related

- [data-table.md](data-table.md) · [library-routes-progress.md](library-routes-progress.md) · [library-routes-outstanding.md](library-routes-outstanding.md)
- [AppLayout sidecar](../../../src/app/components/AppLayout/AppLayout.md)
- [BuildFooter sidecar](../../../src/app/components/BuildFooter/BuildFooter.md)
- [data-model](../data-model/README.md)
- [repeater-directories](../repeater-directories/README.md)
- [report](../report/README.md) · [maidenhead.md](../maidenhead.md) · [bands reference](../../reference/bands.md)
- [DESIGN.md](../../../DESIGN.md)
