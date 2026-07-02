# Operator lifecycle

How an operator moves from a blank browser tab to a portable project backup and back — without leaving the Studio SPA.

**Tracking:** Phase 3 [#59](https://github.com/pskillen/codeplug-studio/issues/59) · [#60](https://github.com/pskillen/codeplug-studio/issues/60)

## Flow

```mermaid
flowchart LR
  Home[Home / Projects]
  Library[Library CRUD]
  IDB[(IndexedDB)]
  Interchange[/interchange]
  YAML[Native YAML file]

  Home -->|Create blank| IDB
  Home -->|Import YAML createNew| IDB
  IDB --> Library
  Library --> Interchange
  Interchange -->|Export download| YAML
  YAML -->|Replace active confirm| IDB
```

## Steps

### 1. Create or open a project

On **Home** (`/`):

- **New project** — blank `ProjectMeta` + empty library seeded in IndexedDB; becomes the active project.
- **Your projects** — switch, rename, or delete. Delete cascades all library and format-build rows for that `projectId`.
- **Import from YAML** — `createNew` mode: parse native YAML, assign a fresh `projectId`, seed persistence, switch active, navigate to `/summary`.

### 2. Edit in the library

With an active project, **Library** routes persist channels, zones, contacts, talk groups, and RX lists per row (`revision` optimistic concurrency). Changes stay in IndexedDB until exported.

### 3. Native YAML interchange

**Interchange** (`/interchange`, active project required):

| Panel                 | Mode                                   | Effect                                                                                 |
| --------------------- | -------------------------------------- | -------------------------------------------------------------------------------------- |
| Export YAML           | `exportProjectYaml` + browser download | Full project snapshot; optional `ProjectMeta.interchange.localFile` remembers filename |
| Import YAML (replace) | `replaceExisting` after confirm modal  | `replaceProject` — wipes stale rows, reseeds from file                                 |

Replace requires the YAML `project.id` to match the active project. There is no merge mode for native YAML.

### 4. Later — CPS build export (Phase 4+)

Format-specific CSV export (`exportBuild`, `assemble`) is separate from native YAML interchange. Operators will export a **build** for vendor CPS; native YAML remains the lossless Studio backup.

## Services (not UI → adapters)

| UI entry            | Service                                   | Persistence                                   |
| ------------------- | ----------------------------------------- | --------------------------------------------- |
| Home import panel   | `importProjectFromYaml` `createNew`       | `seedProject`                                 |
| Interchange replace | `importProjectFromYaml` `replaceExisting` | `replaceProject`                              |
| Interchange export  | `exportProjectToYaml`                     | `loadProjectSeed` + optional `putProjectMeta` |

App wiring: `src/app/services/projectInterchangeService.ts`.

## Related

- [import-export/native-yaml](../import-export/native-yaml/README.md)
- [app-shell](README.md) — routes and project lifecycle
- [storage.md](../../poc-migration/storage.md) — IndexedDB design
