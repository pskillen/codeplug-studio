# ExportBuildCpsPanel

Per-build CPS export on the Radio builds detail page — per-file CSV downloads, ZIP archive download, and Google Drive ZIP upload.

## Props

| Prop    | Type          | Description                                   |
| ------- | ------------- | --------------------------------------------- |
| `build` | `FormatBuild` | Active format build (format, profile, layout) |

## Behaviour

- Uses the build’s **saved** `profileId` from the Target section (no export-time profile override).
- Disables export actions when the project library has no channels.
- Shows export warnings returned by the format adapter (profile limits, name length, etc.).
- **Download ZIP** packages all CPS CSV files via `buildCpsExportService.downloadCpsZip`.
- **Individual files** trigger `downloadCpsFile` per adapter `fileNames`.
- **Save ZIP to Drive** opens `DriveBrowserModal` in save mode (`saveConflictKind: zip`) and uploads via `uploadCpsZipToDrive`.
- Planned formats (`exportStatus !== 'shipped'`) show a grey alert instead of actions.

## Usage

```tsx
import ExportBuildCpsPanel from '../../components/builds/ExportBuildCpsPanel.tsx';

<ExportBuildCpsPanel build={build} />;
```

## Related

- [`buildCpsExportService.ts`](../../services/buildCpsExportService.ts) — assemble + export + download/Drive wiring
- [`docs/features/builds/README.md`](../../../../docs/features/builds/README.md) — build export workflow
