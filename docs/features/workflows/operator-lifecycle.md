# Operator lifecycle

How an operator moves from a blank browser tab to a portable project backup and back — without leaving the Studio SPA.

**Tracking:** Phase 3 [#35](https://github.com/pskillen/codeplug-studio/issues/35) · [#59](https://github.com/pskillen/codeplug-studio/issues/59)–[#62](https://github.com/pskillen/codeplug-studio/issues/62)

## Flow

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
  Home -->|Import YAML createNew| IDB
  Home -->|Open from Drive| Drive
  Settings -->|Connect OAuth| Drive
  IDB --> Library
  Library --> ImportExport
  ImportExport -->|Export download| YAML
  ImportExport -->|Save to Drive| Drive
  ImportExport -->|Open from Drive replace| Drive
  YAML -->|Replace active confirm| IDB
  Drive -->|YAML content| IDB
```

## Steps

### 1. Create or open a project

On **Home** (`/`):

- **New project** — blank `ProjectMeta` + empty library seeded in IndexedDB; becomes the active project.
- **Your projects** — switch, rename, or delete. Delete cascades all library and format-build rows for that `projectId`.
- **Import from YAML** — `createNew` mode: parse native YAML (local file or **Open from Drive**), assign a fresh `projectId`, seed persistence, switch active, navigate to `/summary`.

### 2. Edit in the library

With an active project, **Library** routes persist channels, zones, contacts, talk groups, and RX lists per row (`revision` optimistic concurrency). Changes stay in IndexedDB until exported.

### 3. Connect Google Drive (optional)

**Settings** (`/settings`) → **Google Drive**:

- Connect with Google OAuth (requires `VITE_GOOGLE_CLIENT_ID` in local builds)
- Token and browse path stay in browser localStorage only

### 4. Import / export (native YAML)

**Import / export** (`/import-export`, active project required):

| Panel                 | Mode                                   | Effect                                                                                 |
| --------------------- | -------------------------------------- | -------------------------------------------------------------------------------------- |
| Export YAML           | `exportProjectYaml` + browser download | Full project snapshot; `interchange.localFile` remembers filename                      |
| Save to Drive         | Drive browser + `writeFile`            | Upload YAML; `interchange.googleDrive` remembers folder + file                         |
| Import YAML (replace) | `replaceExisting` after confirm modal  | `replaceProject` — local file or **Open from Drive**                                   |

Replace requires the YAML `project.id` to match the active project. There is no merge mode for native YAML.

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
