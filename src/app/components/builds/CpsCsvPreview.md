# CpsCsvPreview

Read-only tabbed table preview of CPS CSV export files.

## Components

| File                     | Role                                                                |
| ------------------------ | ------------------------------------------------------------------- |
| `CpsCsvPreview.tsx`      | Tabbed `Table` per CSV file                                         |
| `CpsCsvPreviewModal.tsx` | Modal shell; loads preview via `useBuildCpsExportPreview` when open |

## Props — `CpsCsvPreview`

| Prop           | Type                       | Description                     |
| -------------- | -------------------------- | ------------------------------- |
| `fileNames`    | `readonly string[]`        | Tab order (from format adapter) |
| `tablesByFile` | `Record<string, CsvTable>` | Parsed headers + rows per file  |
| `loading`      | `boolean`                  | Show spinner while serialising  |
| `error`        | `string \| null`           | Export/preview failure message  |

## Usage

```tsx
import CpsCsvPreviewModal from './CpsCsvPreviewModal.tsx';

<CpsCsvPreviewModal
  opened={previewOpen}
  onClose={() => setPreviewOpen(false)}
  build={build}
  exportOptions={exportOptions}
/>;
```

## Behaviour

- Parses CSV by header row (`csvToTable` in core) — not column index.
- Each tab shows a row-count badge.
- Per-column **Filter** inputs (case-insensitive substring; AND across columns).
- Click a column header to sort ascending/descending (locale-aware, numeric-aware).
- `CpsCsvPreviewModal` fetches only while `opened` (lazy serialisation).
- Export warnings appear in a yellow alert above the tabs (`ExportWarningsAlert` — groups collapsed by default).

## Related

- [`ExportBuildCpsPanel.tsx`](ExportBuildCpsPanel.tsx) — **Preview CSV** outline button
- [`docs/features/builds/README.md`](../../../../docs/features/builds/README.md)
