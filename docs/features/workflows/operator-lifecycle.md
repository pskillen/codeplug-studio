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
    R2[Export CPS]
  end
  IDB[(IndexedDB edit store)]

  A1 --> IDB
  A2 --> YAML
  B1 --> YAML
  B1 --> IDB
  B2 --> YAML
  R1 --> YAML
  R1 --> IDB
  R2 --> IDB
```

Legacy single-browser flow:

```mermaid
flowchart LR
  Home[Home / Projects]
  Library[Library CRUD]
  IDB[(IndexedDB)]
  ImportExport[/import-export]
  Settings[Settings]
  YAML[Native YAML file]
  Drive[Google Drive]

  Home -->|Create blank| IDB
  Home -->|Import YAML| IDB
  Home -->|Open from Drive| Drive
  Settings -->|Reconnect OAuth| Drive
  IDB --> Library
  Library --> ImportExport
  ImportExport -->|Export download| YAML
  ImportExport -->|Save to Drive| Drive
  Drive -->|YAML content| IDB
```

## Steps

### 1. Create or open a project

On **Home** (`/`):

- **New project** — blank `ProjectMeta` + empty library seeded in IndexedDB; becomes the active project.
- **Your projects** — switch, rename, or delete. Delete cascades all library and format-build rows for that `projectId`.
- **Import from YAML** — `createNew` mode: parse native YAML (local file or **Open from Drive**), assign a fresh `projectId`, seed persistence, switch active, navigate to `/summary`.

### 2. Edit in the library

With an active project, **Library** routes persist channels, zones, contacts, talk groups, and RX lists per row (`revision` optimistic concurrency). Changes stay in IndexedDB until saved to a portable destination.

**App chrome** (`ProjectInterchangeBar`):

- Shows interchange source when `ProjectMeta.interchange` is set
- **Save to Drive** when the project has a remembered Drive file and local edits are newer than last sync
- Soft warning when the project exists only in this browser

### 3. Connect Google Drive (optional)

**Settings** (`/settings`) → **Google Drive**:

- Connect with Google OAuth (requires `VITE_GOOGLE_CLIENT_ID` in local builds)
- Token and browse path stay in browser localStorage only
- Expired sessions reconnect inline — Settings **Reconnect**, `DriveSessionBanner`, or any Drive action ([#286](https://github.com/pskillen/codeplug-studio/issues/286))

### 4. Import / export (native YAML)

**Import / export** (`/import-export`, active project required):

| Panel                 | Mode                                   | Effect                                                            |
| --------------------- | -------------------------------------- | ----------------------------------------------------------------- |
| Export YAML           | `exportProjectYaml` + browser download | Full project snapshot; `interchange.localFile` remembers filename |
| Save to Drive         | Drive browser + `writeFile`            | Upload YAML; `interchange.googleDrive` remembers folder + file    |
| Import YAML (replace) | `replaceExisting` after confirm modal  | `replaceProject` — local file or **Open from Drive**              |

Replace requires the YAML `project.id` to match the active project (replace panel) or offers **overwrite with diff** when opening a YAML whose id already exists (Home / Drive). There is no merge mode for native YAML.

When switching to a project linked to Drive, **Refresh from Drive** compares remote `modifiedTime` and offers a non-blocking overwrite ([#285](https://github.com/pskillen/codeplug-studio/issues/285)).

### 5. Later — CPS build export (Phase 4+)

Format-specific CSV export (`exportBuild`, `assemble`) is separate from native YAML import/export. Operators will export a **build** for vendor CPS; native YAML remains the lossless Studio backup.

## Services (not UI → adapters)

| UI entry                | Service                                   | Persistence                                   |
| ----------------------- | ----------------------------------------- | --------------------------------------------- |
| Home import panel       | `importProjectFromYaml` `createNew`       | `seedProject`                                 |
| Import / export replace | `importProjectFromYaml` `replaceExisting` | `replaceProject`                              |
| Import / export export  | `exportProjectToYaml`                     | `loadProjectSeed` + optional `putProjectMeta` |
| Save to Drive           | `exportProjectToYaml` + `GoogleDrivePort` | `putProjectMeta` + Drive file                 |

App wiring: `src/app/services/projectImportExportService.ts`, `src/integrations/cloud/googleDrive.ts`.

## Related

- [import-export/google-drive](../import-export/google-drive.md)
- [import-export/native-yaml](../import-export/native-yaml/README.md)
- [app-shell](README.md) — routes and project lifecycle
- [storage.md](../../poc-migration/storage.md) — IndexedDB design
