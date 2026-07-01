# App shell & project lifecycle

Tier-1 reference for the Phase 2 application shell: navigation chrome, route surfaces, and the project lifecycle (create blank project, switch, rename, delete).

**Tracking:** Phase 2 [#8](https://github.com/pskillen/codeplug-studio/issues/8) (Epic [#1](https://github.com/pskillen/codeplug-studio/issues/1))

**Source:** `src/app/`

## Overview

The SPA uses Mantine `AppShell` with two-section navigation (primary + section nav), matching the codeplug-tool UI kit. `ProjectProvider` supplies project state via `useProjects()`.

```text
ProjectProvider
└─ HashRouter
   └─ AppLayout (AppShell: header + AppNav + SectionNav + Outlet + footer)
      ├─ /          Projects (lifecycle UI)
      ├─ /library   Library inventory + entity editors
      ├─ /map       Channel map
      ├─ /reports   Library summary
      ├─ /reference Reference tools
      ├─ /settings  Settings shell
      └─ /help      Help shell
```

UI primitives live in `src/app/components/ui/` (ported from codeplug-tool). Dev styleguide: `/#/styleguide` (unlinked).

## Routes

| Path                                      | Surface                 | Status                                                       |
| ----------------------------------------- | ----------------------- | ------------------------------------------------------------ |
| `/`                                       | Projects                | Lifecycle UI (create/switch/rename/del)                      |
| `/library`                                | Library                 | Entity CRUD — Ticket #10                                     |
| `/library/channels/add-from-ukrepeater`   | Add from ukrepeater.net | [repeater-directories](../repeater-directories/README.md)    |
| `/library/channels/add-from-brandmeister` | Add from BrandMeister   | [repeater-directories](../repeater-directories/README.md)    |
| `/map`                                    | Map                     | Channel map — Ticket #11                                     |
| `/reports`                                | Reports                 | [Library summary](../reports/README.md) — Ticket #12         |
| `/reference`                              | Reference               | [Reference tools](../reference-tools/README.md) — Ticket #12 |
| `/settings`                               | Settings                | Shell content                                                |
| `/help`                                   | Help                    | Shell content                                                |
| `/styleguide`                             | Styleguide              | Hidden dev page (UI kit demos)                               |

Routes that need a project gate on an active project and link back to Projects when none is selected.

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

The **active-project selection** is remembered across reloads via `localStorage` (`src/integrations/preferences/`), reconciled against the loaded project list on startup. `localStorage` access stays in the integrations layer.

## Boundaries

- App layer only (`src/app/`); calls `core` factories and the `integrations` persistence port — never low-level mutations ad hoc.
- Vendor-neutral: no format strings, radio caps, or CSV concepts in the shell.

## Related

- [AppLayout sidecar](../../../src/app/components/AppLayout/AppLayout.md)
- [data-model](../data-model/README.md)
- [repeater-directories](../repeater-directories/README.md)
- [reports](../reports/README.md) · [reference-tools](../reference-tools/README.md)
- [DESIGN.md](../../../DESIGN.md)
