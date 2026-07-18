# ProjectSyncDiffTable

Tabular local-vs-remote summary for portable YAML overwrite and Drive save-conflict flows.

## Purpose

Shows every portable child-item count plus **Last edited** / **Last Drive or file save** timestamps so operators can judge which copy is newer before overwrite or force-save.

## Props

| Prop   | Type              | Notes                                          |
| ------ | ----------------- | ---------------------------------------------- |
| `diff` | `ProjectSyncDiff` | From `buildImportOverwriteDiff` / core summary |

## Behaviour

- Short caption explains the two timestamp rows in plain language
- Columns: **Compare**, **Local**, **Remote**, **Δ**
- Timestamps use the browser locale with a 24-hour clock (en-GB / dd/mm/yyyy fallback)
- Timestamp rows highlight the newer side; Δ shows `local newer` / `remote newer` / `same`
- Count rows include channels, zones, talk groups, digital/analog contacts, RX group lists, scan lists, APRS configurations, and format builds
- Non-zero count deltas are emphasised (teal for remote higher, orange for remote lower)

## Related

- [`InterchangeOverwriteModal`](./InterchangeOverwriteModal.tsx)
- [`DriveSaveConflictModal`](./DriveSaveConflictModal.tsx)
- [google-drive.md](../../../../docs/features/import-export/google-drive.md)
- `@core/services/projectSyncSummary`
