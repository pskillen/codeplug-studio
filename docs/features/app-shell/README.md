# App shell & project lifecycle

Tier-1 reference for the Phase 2 application shell: navigation chrome, route surfaces, and the project lifecycle (create blank project, switch, rename, delete).

**Tracking:** Phase 2 [#8](https://github.com/pskillen/codeplug-studio/issues/8) (Epic [#1](https://github.com/pskillen/codeplug-studio/issues/1)); library list routes [#20](https://github.com/pskillen/codeplug-studio/issues/20)

**Source:** `src/app/`

## Overview

The SPA uses Mantine `AppShell` with two-section navigation (primary + section nav), matching the codeplug-tool UI kit. `ProjectProvider` supplies project state via `useProjects()`. Visible product title: **MM9PDY Codeplug Studio**.

```text
ProjectProvider
└─ OperatorPositionProvider
   └─ HashRouter
      └─ AppLayout (AppShell: header + AppNav + SectionNav + Outlet + footer)
         ├─ /          Projects (lifecycle UI)
         ├─ /library/* Per-entity library list routes (see library docs)
         ├─ /summary   Library summary
         ├─ /map       _(redirect → /library/channels)_
         ├─ /reference Reference tools
         ├─ /settings  Settings shell
         └─ /help      Help shell
```

UI primitives live in `src/app/components/ui/` (ported from codeplug-tool). Dev styleguide: `/#/styleguide` (unlinked).

## Routes

| Path                                      | Surface                 | Status                                                                                                                                                 |
| ----------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/`                                       | Projects                | Lifecycle UI (create/switch/rename/del)                                                                                                                |
| `/library`                                | _(redirect)_            | → `/library/channels`                                                                                                                                  |
| `/library/channels`                       | Channels list           | DataTable + filters + map — [#20](https://github.com/pskillen/codeplug-studio/issues/20), [#24](https://github.com/pskillen/codeplug-studio/issues/24) |
| `/library/zones`                          | Zones list              | Card list + map — [#20](https://github.com/pskillen/codeplug-studio/issues/20)                                                                         |
| `/library/talk-groups`                    | Talk groups list        | Card list — [#20](https://github.com/pskillen/codeplug-studio/issues/20)                                                                               |
| `/library/contacts`                       | Contacts list           | Digital + analog sections — [#20](https://github.com/pskillen/codeplug-studio/issues/20)                                                               |
| `/library/rx-group-lists`                 | RX group lists list     | Card list — [#20](https://github.com/pskillen/codeplug-studio/issues/20)                                                                               |
| `/library/:kind/:id`                      | Entity editor           | CRUD forms — [#10](https://github.com/pskillen/codeplug-studio/issues/10)                                                                              |
| `/library/channels/add-from-ukrepeater`   | Add from ukrepeater.net | [repeater-directories](../repeater-directories/README.md)                                                                                              |
| `/library/channels/add-from-brandmeister` | Add from BrandMeister   | [repeater-directories](../repeater-directories/README.md)                                                                                              |
| `/map`                                    | _(redirect)_            | → `/library/channels` (legacy [#11](https://github.com/pskillen/codeplug-studio/issues/11))                                                            |
| `/summary`                                | Summary                 | [Library summary](../report/README.md) — Ticket #12                                                                                                    |
| `/reports`                                | _(redirect)_            | Redirects to `/summary` (legacy hash route)                                                                                                            |
| `/reference`                              | Reference               | [Maidenhead + band tools](../maidenhead.md), [bands](../../reference/bands.md) — Ticket #12                                                            |
| `/settings`                               | Settings                | Shell content                                                                                                                                          |
| `/help`                                   | Help                    | Shell content                                                                                                                                          |
| `/styleguide`                             | Styleguide              | Hidden dev page (UI kit demos)                                                                                                                         |

Routes that need a project gate on an active project and link back to Projects when none is selected.

## Section navigation

Library list routes each have a dedicated section-nav entry (longest-prefix match in `sectionNavRegistry.ts`). Shared entity links come from `routes/library/nav.ts`; contextual **New …** actions vary per route (e.g. contacts: New digital + New analog; channels: repeater import buttons + filters).

## Project lifecycle

State flows through a thin app-state adapter, `ProjectStore` (`src/app/state/projectStore.ts`), over the `ProjectPersistence` port:

| Operation | Behaviour                                                    |
| --------- | ------------------------------------------------------------ |
| Create    | `newProjectMeta` + empty library seeded; becomes active      |
| List      | Sorted by name from the port                                 |
| Switch    | Sets the active project id (persisted to `localStorage`)     |
| Rename    | Loads meta, `putProjectMeta` with optimistic revision        |
| Delete    | Removes the project metadata row; clears active id if it was |

## Persistence note

Projects and library rows persist durably in the browser via IndexedDB (Ticket [#9](https://github.com/pskillen/codeplug-studio/issues/9)): one row per entity, optimistic `revision` concurrency, and `BroadcastChannel` cross-tab notifications. A shared singleton (`src/app/state/persistence.ts`) backs the whole app. See [storage.md](../../poc-migration/storage.md) and [library](../library/README.md).

The **active-project selection** is remembered across reloads via `localStorage` (`src/integrations/preferences/`), reconciled against the loaded project list on startup. Channel list filter prefs and column visibility use per-project `localStorage` keys under `mm9pdy-codeplug-studio.list.*`.

## Boundaries

- App layer only (`src/app/`); calls `core` factories and the `integrations` persistence port — never low-level mutations ad hoc.
- Vendor-neutral: no format strings, radio caps, or CSV concepts in the shell.

## Related

- [library-routes-progress.md](library-routes-progress.md) · [library-routes-outstanding.md](library-routes-outstanding.md)
- [AppLayout sidecar](../../../src/app/components/AppLayout/AppLayout.md)
- [data-model](../data-model/README.md)
- [repeater-directories](../repeater-directories/README.md)
- [report](../report/README.md) · [maidenhead.md](../maidenhead.md) · [bands reference](../../reference/bands.md)
- [DESIGN.md](../../../DESIGN.md)
