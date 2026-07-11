# InterchangeOverwriteModal

Confirm dialog before replacing a local project with remote native YAML (Drive refresh or open-from-file flows).

## Props

| Prop              | Type             | Notes                                                   |
| ----------------- | ---------------- | ------------------------------------------------------- |
| `opened`          | `boolean`        | Modal visibility                                        |
| `title`           | `string`         | Modal heading                                           |
| `projectName`     | `string`         | Local project display name                              |
| `diffLines`       | `string[]`       | Remote vs local summary lines                           |
| `loading`         | `boolean`        | Disables actions while import runs                      |
| `error`           | `string \| null` | Import failure message (keeps modal open)               |
| `idMismatch`      | `boolean`        | Remote `project.id` differs from local                  |
| `localProjectId`  | `string`         | Shown when `idMismatch`                                 |
| `remoteProjectId` | `string`         | Shown when `idMismatch`                                 |
| `onClose`         | `() => void`     | Cancel / dismiss                                        |
| `onConfirm`       | `() => void`     | Overwrite local copy, or adopt remote when ids mismatch |
| `onImportAsNew`   | `() => void`     | Optional — import remote YAML as a new project          |

## Behaviour

- **Matching ids:** single red **Overwrite local copy** button.
- **Mismatched ids:** shows both project ids, **Replace local content** (adopt remote into local id) and **Import as new project**.
- Import errors render in a red alert above the actions; the modal stays open.

## Related

- [google-drive.md](../../../../docs/features/import-export/google-drive.md)
- `RefreshFromDriveBanner`, `ImportProjectYamlPanel`, `ImportYamlIntoActivePanel`
