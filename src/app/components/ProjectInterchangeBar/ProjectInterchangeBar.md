# ProjectInterchangeBar

App-chrome bar showing portable interchange source and Save affordance for the active project.

## Purpose

Surfaces per-project Google Drive / local-file interchange memory from `ProjectMeta.interchange` with a **Save to Drive** control (enabled when local edits are newer than the last portable sync).

## Usage

```tsx
<ProjectInterchangeBar />
```

Mounted in `AppLayout` above route content when a project is active.

## Behaviour

| State                        | UI                                               |
| ---------------------------- | ------------------------------------------------ |
| `interchange.googleDrive`    | Label + **Save to Drive** (disabled until dirty) |
| `interchange.localFile` only | Label + link to `/import-export` export          |
| No interchange               | `BrowserOnlyWarning` dismissible alert           |

Save uses `saveProjectToDrive` + `withDriveAuthRetry` and refreshes project list + dirty state.

## Related

- `BrowserOnlyWarning.tsx`
- [google-drive.md](../../../../docs/features/import-export/google-drive.md)
- [app-shell/README.md](../../../../docs/features/app-shell/README.md)
