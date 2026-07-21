# Operator lifecycle

How an operator moves from a blank browser tab to a portable project backup and back — without leaving the Studio SPA.

**Tracking:** Phase 3 [#35](https://github.com/pskillen/codeplug-studio/issues/35) · [#285](https://github.com/pskillen/codeplug-studio/issues/285) · [#286](https://github.com/pskillen/codeplug-studio/issues/286)

## Flow

```mermaid
flowchart LR
  subgraph machineA [Machine A]
    A1[Create project]
    A2[Save to Drive]
  end
  subgraph drive [Google Drive]
    YAML[project.yaml]
  end
  subgraph machineB [Machine B]
    B1[Open from Drive]
    B2[Edit + Save bar]
  end
  subgraph machineA2 [Machine A return]
    R1[Refresh from Drive]
    R2[Save conflict check]
    R3[Export CPS]
  end
  IDB[(IndexedDB edit store)]

  A1 --> IDB
  A2 --> YAML
  B1 --> YAML
  B1 --> IDB
  B2 --> YAML
  R1 --> YAML
  R1 --> IDB
  R2 --> YAML
  R3 --> IDB
```

Legacy single-browser flow:

```mermaid
flowchart LR
  Home[Home / Projects]
  Library[Library CRUD]
  IDB[(IndexedDB)]
  Summary[/summary]
  Settings[Settings]
  YAML[Native YAML file]
  Drive[Google Drive]

  Home -->|Create blank| IDB
  Home -->|Import YAML| IDB
  Home -->|Open from Drive| Drive
  Settings -->|Reconnect OAuth| Drive
  IDB --> Library
  Library --> Summary
  Summary -->|Export download| YAML
  Summary -->|Save to Drive| Drive
  Drive -->|YAML content| IDB
```

## Steps

### 1. Create or open a project

On **Home** (`/`):

- **New project** — blank `ProjectMeta` + empty library seeded in IndexedDB; becomes the active project.
- **Your projects** — switch, rename, or delete. Delete cascades all library and format-build rows for that `projectId`. When there are no projects yet, an inline **getting-started** guide appears here instead ([#345](https://github.com/pskillen/codeplug-studio/issues/345)).
- **Import from YAML** — below the projects list (or empty guide); `createNew` mode: parse native YAML (local file or **Open from Drive**), assign a fresh `projectId`, seed persistence, switch active, navigate to `/summary`.
- **Quick start** — page action opens the same guide in a voluntary modal (also available from **Help**).

See [onboarding](../onboarding/README.md).

### 2. Edit in the library

With an active project, **Library** routes persist channels, zones, contacts, talk groups, and RX lists per row (`revision` optimistic concurrency). Changes stay in IndexedDB until saved to a portable destination.

**Primary sidebar** (`SidebarDriveControls`):

- Shows interchange source when `ProjectMeta.interchange` is set
- **Save to Drive** when the project has a remembered Drive file and local edits are newer than last sync — pre-save conflict check blocks silent overwrite when another device saved more recently ([#335](https://github.com/pskillen/codeplug-studio/issues/335))
- **Check Drive** for manual remote-newer detection ([#368](https://github.com/pskillen/codeplug-studio/issues/368))
- Soft warning when the project exists only in this browser and the operator has used Drive on this browser before

### 3. Connect Google Drive (optional)

**Settings** (`/settings`) → **Google Drive**:

- Connect with Google OAuth (requires `VITE_GOOGLE_CLIENT_ID` in local builds)
- Token and browse path stay in browser localStorage only
- Expired sessions reconnect inline — Settings **Reconnect**, sidebar Save/Check click, or any Drive action ([#286](https://github.com/pskillen/codeplug-studio/issues/286), [#368](https://github.com/pskillen/codeplug-studio/issues/368))

### 4. Project interchange (native YAML)

**Summary** (`/summary`, active project required) → **Project interchange**:

| Panel                 | Mode                                   | Effect                                                            |
| --------------------- | -------------------------------------- | ----------------------------------------------------------------- |
| Export YAML           | `exportProjectYaml` + browser download | Full project snapshot; `interchange.localFile` remembers filename |
| Save to Drive         | Drive browser + `writeFile`            | Upload YAML; `interchange.googleDrive` remembers folder + file    |
| Import YAML (replace) | `replaceExisting` after confirm modal  | `replaceProject` — local file or **Open from Drive**              |

Replace requires the YAML `project.id` to match the active project (replace panel) or offers **overwrite with diff** when opening a YAML whose id already exists (Home / Drive). There is no merge mode for native YAML.

When switching to a project linked to Drive, **Refresh from Drive** compares remote `modifiedTime` and offers a non-blocking overwrite ([#285](https://github.com/pskillen/codeplug-studio/issues/285)). **Save to Drive** runs the same comparison before push — Machine A must not silently clobber Machine B's newer YAML ([#335](https://github.com/pskillen/codeplug-studio/issues/335)).

`/import-export` permanently redirects to `/summary`.

### 5. Later — CPS build export (Phase 4+)

Format-specific CSV export (`exportBuild`, `assemble`) is separate from native YAML import/export. Operators export a **build** under **Export for radio**; native YAML remains the lossless Studio backup.

## Services (not UI → adapters)

| UI entry          | Service                                   | Persistence                                   |
| ----------------- | ----------------------------------------- | --------------------------------------------- |
| Home import panel | `importProjectFromYaml` `createNew`       | `seedProject`                                 |
| Summary replace   | `importProjectFromYaml` `replaceExisting` | `replaceProject`                              |
| Summary export    | `exportProjectToYaml`                     | `loadProjectSeed` + optional `putProjectMeta` |
| Save to Drive     | `exportProjectToYaml` + `GoogleDrivePort` | `putProjectMeta` + Drive file                 |

App wiring: `src/app/services/projectImportExportService.ts`, `src/integrations/cloud/googleDrive.ts`.

## Related

- [import-export/google-drive](../import-export/google-drive.md)
- [import-export/native-yaml](../import-export/native-yaml/README.md)
- [app-shell](README.md) — routes and project lifecycle
- [storage.md](../../poc-migration/storage.md) — IndexedDB design
