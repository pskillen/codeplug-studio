# App shell & project lifecycle

Tier-1 reference for the Phase 2 application shell: navigation chrome, route surfaces, and the project lifecycle (create blank project, switch, rename, delete).

**Tracking:** Phase 2 [#8](https://github.com/pskillen/codeplug-studio/issues/8) (Epic [#1](https://github.com/pskillen/codeplug-studio/issues/1))

**Source:** `src/app/`

## Overview

The SPA renders a single `AppLayout` (header + nav + `Outlet` + `BuildFooter`) wrapping all routes under a `HashRouter`. A `ProjectProvider` supplies project state to the tree via the `useProjects()` hook.

```text
ProjectProvider
└─ HashRouter
   └─ AppLayout (header/nav + Outlet + footer)
      ├─ /          Projects (lifecycle UI)
      ├─ /library   Library      (placeholder → #10)
      ├─ /map       Map          (placeholder → #11)
      ├─ /reports   Reports      (placeholder → #12)
      ├─ /settings  Settings shell
      └─ /help      Help shell
```

## Routes

| Path        | Surface  | Status                                  |
| ----------- | -------- | --------------------------------------- |
| `/`         | Projects | Lifecycle UI (create/switch/rename/del) |
| `/library`  | Library  | CRUD UI — Ticket #10                    |
| `/map`      | Map      | Placeholder — Ticket #11                |
| `/reports`  | Reports  | Placeholder — Ticket #12                |
| `/settings` | Settings | Shell content                           |
| `/help`     | Help     | Shell content                           |

Feature placeholders gate on an active project and link back to Projects when none is selected.

## Project lifecycle

State flows through a thin app-state adapter, `ProjectStore` (`src/app/state/projectStore.ts`), over the `ProjectPersistence` port:

| Operation | Behaviour                                                    |
| --------- | ------------------------------------------------------------ |
| Create    | `newProjectMeta` + empty library seeded; becomes active      |
| List      | Sorted by name from the port                                 |
| Switch    | Sets the active project id (UI state only)                   |
| Rename    | Loads meta, `putProjectMeta` with optimistic revision        |
| Delete    | Removes the project metadata row; clears active id if it was |

## Persistence note

Projects and library rows persist durably in the browser via IndexedDB (Ticket [#9](https://github.com/pskillen/codeplug-studio/issues/9)): one row per entity, optimistic `revision` concurrency, and `BroadcastChannel` cross-tab notifications. A shared singleton (`src/app/state/persistence.ts`) backs the whole app. See [storage.md](../../poc-migration/storage.md) and [library](../library/README.md).

## Boundaries

- App layer only (`src/app/`); calls `core` factories and the `integrations` persistence port — never low-level mutations ad hoc.
- Vendor-neutral: no format strings, radio caps, or CSV concepts in the shell.

## Related

- [AppLayout sidecar](../../../src/app/components/AppLayout/AppLayout.md)
- [data-model](../data-model/README.md)
- [DESIGN.md](../../../DESIGN.md)
