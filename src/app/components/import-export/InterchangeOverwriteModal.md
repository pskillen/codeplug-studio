# InterchangeOverwriteModal

"Which copy of {project} do you want?" dialog shown before a local project is replaced by a remote native YAML (Drive refresh, or open-from-file / open-from-Drive resolver flows).

## Purpose

Lets the operator choose between this browser's copy and the incoming copy with the facts that matter up front, makes data loss explicit, and offers a safe way out ([#1509](https://github.com/pskillen/codeplug-studio/issues/1509)).

## Props

| Prop              | Type                      | Notes                                                                                |
| ----------------- | ------------------------- | ------------------------------------------------------------------------------------ |
| `opened`          | `boolean`                 | Modal visibility                                                                     |
| `title`           | `string`                  | Optional override of the default heading                                             |
| `projectName`     | `string`                  | Display name used in the heading                                                     |
| `diff`            | `ProjectSyncDiff \| null` | Summaries, timestamps, counts and `entityChanges` (built in core)                    |
| `source`          | `'drive' \| 'file'`       | Wording: Google Drive vs File. Default `drive`                                       |
| `loading`         | `boolean`                 | Disables actions while import runs                                                   |
| `error`           | `string \| null`          | Import failure message (keeps modal open)                                            |
| `idMismatch`      | `boolean`                 | Remote `project.id` differs from local                                               |
| `localProjectId`  | `string`                  | Needed for **Back up local YAML**; shown when `idMismatch`                           |
| `remoteProjectId` | `string`                  | Shown when `idMismatch`                                                              |
| `onClose`         | `() => void`              | Close (x / Escape)                                                                   |
| `onConfirm`       | `() => void`              | Use the incoming copy (adopt remote when ids mismatch)                               |
| `onKeepLocal`     | `() => void`              | **Keep this browser's**; defaults to `onClose`. Drive flow also dismisses the banner |
| `onImportAsNew`   | `() => void`              | Optional, id-mismatch only — import remote YAML as a new project                     |

## Behaviour

- Two cards: **This browser** (last edited, synced time, "No unsaved edits" or an unsynced-edits warning) and **Google Drive** / **File** (saved time, **newer** badge, count summary of non-zero deltas such as "+1 radio build").
- A loss warning ("Edits made in this browser after {time} will be lost.") and a destructive primary button appear **only** when the local copy has library edits after its last sync (`hasUnsyncedLocalEdits` in `projectSyncSummary.ts`). Otherwise the primary **Use Drive copy** / **Use file copy** is a normal primary button.
- "Changes on {source}" lists entities that differ by UUID (added green, removed red, changed yellow), computed in `projectEntityDiff.ts`; 8 rows by default with a **Show all N changes** toggle. Zero differences shows a plain "No differences" line.
- **Back up local YAML** downloads the local project via `backupLocalProjectYaml` and leaves the dialog open.
- **Id mismatch:** keeps **Keep this browser's**, **Import as new project** and **Replace local content** (always destructive) and shows both project ids.
- Import errors render in a banner; the modal stays open.

## Related

- [google-drive.md](../../../../docs/features/import-export/google-drive.md)
- `RefreshFromDriveBanner`, `ChromeDismissibleNotices`, `ImportProjectYamlPanel`, `ImportYamlIntoActivePanel`
