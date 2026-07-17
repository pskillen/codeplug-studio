# App shell & project lifecycle

Tier-1 reference for the Phase 2 application shell: navigation chrome, route surfaces, and the project lifecycle (create blank project, switch, rename, delete).

**Tracking:** Phase 2 [#8](https://github.com/pskillen/codeplug-studio/issues/8) (Epic [#1](https://github.com/pskillen/codeplug-studio/issues/1)); library list routes [#20](https://github.com/pskillen/codeplug-studio/issues/20); GitHub feedback links [#70](https://github.com/pskillen/codeplug-studio/issues/70)

**Source:** `src/app/`

## Overview

The SPA uses Mantine `AppShell` with two-section navigation (primary + section nav), matching the codeplug-tool UI kit. `ProjectProvider` supplies project state via `useProjects()`. Visible product title: **MM9PDY Codeplug Studio**.

```text
ProjectProvider
└─ DriveSessionProvider
   └─ OperatorPositionProvider
      └─ BrowserRouter
      └─ AppLayout (DriveRefreshProvider → AppShell: header + AppNav + SectionNav + RefreshFromDriveBanner + Outlet + footer)
         ├─ /          Projects (lifecycle UI)
         ├─ /library/* Per-entity library list routes (see library docs)
         ├─ /import-export Native YAML import/export (active project)
         ├─ /summary   Library summary
         ├─ /map       _(redirect → /library/channels)_
         ├─ /reference Reference tools
         ├─ /debug     Storage inspectors (IndexedDB + localStorage)
         ├─ /settings  Settings shell
         ├─ /privacy   Privacy policy (analytics + local data)
         ├─ /terms     Terms of use
         ├─ /cookies   Cookies & storage (+ change consent)
         ├─ /help      Help shell
```

## Documentation map

| Doc                                                                                           | Contents                                                                                        |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [data-table.md](data-table.md)                                                                | `DataTable`, list prefs, entity list hooks, virtualization                                      |
| [list-kit-roles.md](list-kit-roles.md)                                                        | Four-role list kit (A/B/C/D) — [#460](https://github.com/pskillen/codeplug-studio/issues/460)   |
| [UI interaction styleguide](../../reference/styleguide/)                                      | Written conventions for agents — [#465](https://github.com/pskillen/codeplug-studio/issues/465) |
| [list-kit-460-progress.md](list-kit-460-progress.md)                                          | List kit + styleguide initiative — shipped slices                                               |
| [list-kit-460-outstanding.md](list-kit-460-outstanding.md)                                    | Deferred adoption / debt from list kit work                                                     |
| [alerts.md](alerts.md)                                                                        | Mantine `Alert` colour conventions                                                              |
| [GradientSegmentedControl](../../src/app/components/ui/GradientSegmentedControl.md)           | Per-segment indicator colours with fade on change                                               |
| [SelectedItemList](../../src/app/components/ui/SelectedItemList.md)                           | Ordered selected-member list shell                                                              |
| [AvailableItemPicker](../../src/app/components/ui/AvailableItemPicker.md)                     | Sectioned pool picker shell                                                                     |
| [PillTabs](../../src/app/components/ui/PillTabs.md)                                           | Tabs with optional leading pill/badge in labels                                                 |
| [ImageCheckbox](../../src/app/components/ui/ImageCheckbox.md)                                 | Card checkbox with optional image or media slot                                                 |
| [BadgeCard](../../src/app/components/ui/BadgeCard.md)                                         | Mantine UI badge feature card                                                                   |
| [AddFromDataSourceModal](../../src/app/components/library/AddFromDataSourceModal.md)          | Channel set + external directory picker modal                                                   |
| [SidebarDriveControls](../../src/app/components/SidebarDriveControls/SidebarDriveControls.md) | Sidebar Save / Check Drive ([#368](https://github.com/pskillen/codeplug-studio/issues/368))     |
| [SoftWarning](../../src/app/components/ui/SoftWarning.md)                                     | Compact theme-aware warning panel for sidebar chrome                                            |
| [ActiveProjectBar](../../src/app/components/ActiveProjectBar/ActiveProjectBar.md)             | Active project name + Switch (closes mobile drawer)                                             |
| [EntityDeleteButton](../../src/app/components/library/EntityDeleteButton.md)                  | Editor footer delete for library entities                                                       |
| [EntityListDeleteAction](../../src/app/components/library/EntityListDeleteAction.md)          | List row delete trash icon                                                                      |
| [library-routes-progress.md](library-routes-progress.md)                                      | Library routes initiative — shipped slices                                                      |
| [library-routes-outstanding.md](library-routes-outstanding.md)                                | Deferred debt from library routes PR                                                            |
| [datatable-virtualization-progress.md](datatable-virtualization-progress.md)                  | [#381](https://github.com/pskillen/codeplug-studio/issues/381) virtual tbody rollout            |
| [DataTable.md](../../src/app/components/ui/DataTable.md)                                      | List primitive sidecar — virtual props                                                          |
| [library/README.md](../library/README.md)                                                     | Library CRUD and list routes                                                                    |
| [map/README.md](../map/README.md)                                                             | Embedded channel map                                                                            |

UI primitives live in `src/app/components/ui/` (ported from codeplug-tool). Reusable list infrastructure is documented in [data-table.md](data-table.md) and [list-kit-roles.md](list-kit-roles.md). Written interaction conventions (which shell, Sort…, reorder): [UI interaction styleguide](../../reference/styleguide/). Inline feedback uses Mantine `Alert` — see [alerts.md](alerts.md). Dev styleguide: `/styleguide` and nested pages (unlinked).

## Routes

| Path                                          | Surface                 | Status                                                                                                                                                                   |
| --------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/`                                           | Projects                | Lifecycle UI (create/switch/rename/delete) + **Import from YAML** ([#60](https://github.com/pskillen/codeplug-studio/issues/60))                                         |
| `/library`                                    | _(redirect)_            | → `/library/channels`                                                                                                                                                    |
| `/library/channels`                           | Channels list           | DataTable + filters + map — [#20](https://github.com/pskillen/codeplug-studio/issues/20), [#24](https://github.com/pskillen/codeplug-studio/issues/24)                   |
| `/library/zones`                              | Zones list              | DataTable + map — [#20](https://github.com/pskillen/codeplug-studio/issues/20)                                                                                           |
| `/library/talk-groups`                        | Talk groups list        | DataTable — [#20](https://github.com/pskillen/codeplug-studio/issues/20)                                                                                                 |
| `/library/contacts`                           | Contacts list           | Digital + analog DataTables — [#20](https://github.com/pskillen/codeplug-studio/issues/20)                                                                               |
| `/library/contacts/add-from-radioid`          | Add from RadioID.net    | [contact-directories](../contact-directories/README.md) ([#379](https://github.com/pskillen/codeplug-studio/issues/379))                                                 |
| `/library/rx-group-lists`                     | RX group lists list     | DataTable — [#20](https://github.com/pskillen/codeplug-studio/issues/20)                                                                                                 |
| `/library/:kind/:id`                          | Entity editor           | CRUD forms — [#10](https://github.com/pskillen/codeplug-studio/issues/10)                                                                                                |
| `/import-export`                              | Import / export         | Native YAML export + replace import — [#59](https://github.com/pskillen/codeplug-studio/issues/59), [#60](https://github.com/pskillen/codeplug-studio/issues/60)         |
| `/library/channels/add-from-ukrepeater`       | Add from ukrepeater.net | [repeater-directories](../repeater-directories/README.md)                                                                                                                |
| `/library/channels/add-from-brandmeister`     | Add from BrandMeister   | [repeater-directories](../repeater-directories/README.md)                                                                                                                |
| `/library/channels/add-from-irts`             | Add from IRTS           | [repeater-directories](../repeater-directories/README.md)                                                                                                                |
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
| `/attributions`                               | Attributions            | External data source credits ([#264](https://github.com/pskillen/codeplug-studio/issues/264))                                                                            |
| `/privacy`                                    | Privacy policy          | Browser-local data + optional analytics summary ([#96](https://github.com/pskillen/codeplug-studio/issues/96))                                                           |
| `/terms`                                      | Terms of use            | Hobby-tool disclaimer ([#96](https://github.com/pskillen/codeplug-studio/issues/96))                                                                                     |
| `/cookies`                                    | Cookies & storage       | Essential vs analytics cookies; change consent ([#96](https://github.com/pskillen/codeplug-studio/issues/96))                                                            |
| `/styleguide`                                 | Styleguide              | Hidden dev page (UI kit demos)                                                                                                                                           |

Routes that need a project gate on an active project and link back to Projects when none is selected.

## Section navigation

Library list routes each have a dedicated section-nav entry (longest-prefix match in `sectionNavRegistry.ts`). Shared entity links come from `routes/library/nav.ts` inside `LibrarySectionNavFrame` (entity links → divider → route-specific controls). Contextual **New …** actions vary per route (e.g. contacts: New digital + New analog; channels: **Add from…** modal for channel sets and external directories).

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

Every routed page renders [`BuildFooter`](../../../src/app/components/BuildFooter/BuildFooter.tsx) below the main `Outlet`. The footer shows build env/version plus muted **Cookies**, **Privacy**, **Terms**, **Repository**, and **Report a bug** links.

A [`CookieConsentBanner`](../../../src/app/components/CookieConsentBanner/CookieConsentBanner.tsx) is mounted in [`AppLayout`](../../../src/app/components/AppLayout/AppLayout.tsx) above the outlet on first visit until the operator accepts or declines analytics cookies. See [analytics](../analytics/README.md).

The **Help** route adds a **Feedback** section with the same repo/issues URLs and short guidance for filing GitHub Issues.

| Area                  | Status  | Notes                                                                                                                      |
| --------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| Global footer links   | Shipped | [#70](https://github.com/pskillen/codeplug-studio/issues/70), [#96](https://github.com/pskillen/codeplug-studio/issues/96) |
| Cookie consent banner | Shipped | [#96](https://github.com/pskillen/codeplug-studio/issues/96)                                                               |
| Help feedback section | Shipped | [#70](https://github.com/pskillen/codeplug-studio/issues/70)                                                               |

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
