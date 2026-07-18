# DriveSaveConflictModal

Blocking confirmation before **Save to Drive** overwrites a linked YAML when the remote file is newer than the last sync or when `project.id` in the file differs from the active project.

## Purpose

Mirrors pull-side [`InterchangeOverwriteModal`](./InterchangeOverwriteModal.tsx) for the push direction ([#335](https://github.com/pskillen/codeplug-studio/issues/335)).

Shows the same [`ProjectSyncDiffTable`](./ProjectSyncDiffTable.tsx) as overwrite/refresh so operators can compare local vs remote counts and timestamps before **Save anyway**.

## Usage

```tsx
<DriveSaveConflictModal
  opened={conflictOpen}
  projectName={projectName}
  conflict={conflict}
  loading={saving}
  error={error}
  onClose={closeConflict}
  onRefreshFromDrive={() => void confirmRefreshFromDrive()}
  onSaveAnyway={() => void confirmSaveAnyway()}
  onSaveAsNew={openSaveAsNew}
/>
```

## Actions

| Conflict kind       | Primary actions                                                   |
| ------------------- | ----------------------------------------------------------------- |
| `remoteNewer`       | **Refresh from Drive**, **Save anyway**, **Save as new file**     |
| `projectIdMismatch` | **Save anyway**, **Save as new file** (shows local vs remote ids) |
| Both                | All of the above                                                  |

## Related

- [`useDriveSaveFlow.ts`](../../hooks/useDriveSaveFlow.ts)
- [google-drive.md](../../../../docs/features/import-export/google-drive.md)
