# DriveBrowserModal

Modal folder browser for Google Drive YAML open/save workflows.

## Purpose

Lets operators navigate Drive folders with breadcrumbs, create folders, open `.yaml` files, or pick a save target folder + filename.

## Props

| Prop                  | Type                  | Description                                                   |
| --------------------- | --------------------- | ------------------------------------------------------------- |
| `opened`              | `boolean`             | Modal visibility                                              |
| `onClose`             | `() => void`          | Close handler                                                 |
| `mode`                | `'open' \| 'save'`    | Open file vs pick save target                                 |
| `interchangeFolderId` | `string?`             | Start folder from project export memory                       |
| `defaultFileName`     | `string?`             | Pre-filled filename in save mode                              |
| `onSelectFile`        | `(selection) => void` | Open mode — file id, name, text                               |
| `onSaveTarget`        | `(target) => void`    | Save mode — folder, path, filename, optional existing file id |
| `port`                | `GoogleDrivePort?`    | Injectable port for tests                                     |

## Behaviour

- Restores browse path from `ProjectMeta.interchange.googleDrive` or localStorage prefs.
- Persists `lastFolderId` and breadcrumb path on navigation.
- Save mode reports `existingFileId` when a same-named YAML exists in the folder (parent shows overwrite confirm).

## Related

- [google-drive.md](../../../../docs/features/import-export/google-drive.md)
- `driveBrowserHelpers.ts`
