# InterchangeOverwriteModal

Confirm dialog before replacing a local project with remote native YAML (Drive refresh or open-from-file flows).

## Props

| Prop              | Type                      | Notes                                                   |
| ----------------- | ------------------------- | ------------------------------------------------------- |
| `opened`          | `boolean`                 | Modal visibility                                        |
| `title`           | `string`                  | Modal heading                                           |
| `projectName`     | `string`                  | Local project display name                              |
| `diff`            | `ProjectSyncDiff \| null` | Local vs remote table via `ProjectSyncDiffTable`        |
| `loading`         | `boolean`                 | Disables actions while import runs                      |
| `error`           | `string \| null`          | Import failure message (keeps modal open)               |
| `idMismatch`      | `boolean`                 | Remote `project.id` differs from local                  |
| `localProjectId`  | `string`                  | Shown when `idMismatch`                                 |
| `remoteProjectId` | `string`                  | Shown when `idMismatch`                                 |
| `onClose`         | `() => void`              | Cancel / dismiss                                        |
| `onConfirm`       | `() => void`              | Overwrite local copy, or adopt remote when ids mismatch |
| `onImportAsNew`   | `() => void`              | Optional — import remote YAML as a new project          |

## Behaviour

- **Matching ids:** single red **Overwrite local copy** button.
- **Mismatched ids:** shows both project ids, **Replace local content** (adopt remote into local id) and **Import as new project**.
- Diff table shows **Last edited** / **Last Drive or file save** plus all portable entity counts (channels, zones, talk groups, contacts, RX lists, scan lists, APRS, builds).
- Import errors render in a red alert above the actions; the modal stays open.

## Related

- [`ProjectSyncDiffTable`](./ProjectSyncDiffTable.tsx)
- [google-drive.md](../../../../docs/features/import-export/google-drive.md)
- `RefreshFromDriveBanner`, `ImportProjectYamlPanel`, `ImportYamlIntoActivePanel`
