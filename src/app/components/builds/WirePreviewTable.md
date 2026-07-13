## Purpose

Legacy inline table with per-row export controls. **Deprecated** — list pages use `WirePreviewDataTable` + `WirePreviewOverrideModal`; channel wire names and skip use `/builds/:id/channels/bulk`.

Retained for **unit tests** of zone-scan expand row behaviour until tests migrate to modal sections.

## Props

| Prop                       | Type                                     | Description                                                               |
| -------------------------- | ---------------------------------------- | ------------------------------------------------------------------------- |
| `rows`                     | `WirePreviewRow[]`                       | Rows from `previewWireRows`                                               |
| `nameLimit`                | `number` (optional)                      | Profile wire name cap; shows error when exceeded                          |
| `onExcludedChange`         | `(row, excluded) => void`                | Skip-from-export toggle handler (`excluded: true` when checked)           |
| `onForceIncludeChange`     | `(row, forceInclude) => void` (optional) | Force-export handler for library `omitFromExport` zones (zones page only) |
| `onWireNameChange`         | `(row, wireName) => void`                | Wire name input handler                                                   |
| `onUnsavedChangesChange`   | `(hasUnsaved) => void` (optional)        | True while any row has an unapplied draft                                 |
| `clickableDefaultWireName` | `boolean` (optional)                     | When true, the default name hint is clickable to store it as an override  |
| `zoneScanContext`          | `ZoneScanWirePreviewContext` (optional)  | Zone expand rows for scan export (tests only)                             |

## Related

- [wire-preview.md](../../../docs/features/builds/wire-preview.md)
- [WirePreviewDataTable.md](./wirePreview/WirePreviewDataTable.md)
- [WirePreviewOverrideModal.md](./wirePreview/WirePreviewOverrideModal.md)
- `useBuildWirePreview` hook
