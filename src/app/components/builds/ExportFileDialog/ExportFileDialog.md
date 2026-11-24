# ExportFileDialog

## Purpose

Shared export dialog (`EgressShell`) for CPS file exports: optional **What to export** (CHIRP profile or NeonPlug donor), **Checks** with `WarningsList`, then **Download** recap.

## Props

| Prop                      | Type                   | Description                             |
| ------------------------- | ---------------------- | --------------------------------------- |
| `open`                    | `boolean`              | Modal visibility                        |
| `onClose`                 | `() => void`           | Close handler                           |
| `build`                   | `RadioBuild`           | Active build                            |
| `projectId`               | `string`               | Active project                          |
| `activeEgress`            | `EgressPath`           | Export pathway                          |
| `formatId`                | `FormatId`             | Wire format                             |
| `formatLabel`             | `string`               | User-facing format name                 |
| `buildProfileId`          | `string`               | Pathway profile id                      |
| `exportProfileId`         | `string`               | CHIRP runtime profile override          |
| `onExportProfileIdChange` | `(id: string) => void` | Sync CHIRP profile with the export page |
| `runtimeExportOverrides`  | `CpsAppExportOptions`  | Egress + file name overrides            |
| `suggestedZipName`        | `string`               | Default archive name                    |
| `exportFileNames`         | `readonly string[]`    | Multi-file delivery list                |
| `hasChannels`             | `boolean`              | Disables delivery when empty            |
| `interchangeFolderId`     | `string \| undefined`  | Enables Save to Drive on Checks         |
| `reloadEgressPaths`       | `() => Promise<void>`  | After NeonPlug donor persistence        |

## Usage

```tsx
<ExportFileDialog
  open={exportDialogOpen}
  onClose={() => setExportDialogOpen(false)}
  build={build}
  projectId={projectId}
  activeEgress={activeEgress}
  formatId={formatId}
  formatLabel="OpenGD77 CSV"
  buildProfileId={profileId}
  exportProfileId={exportProfileId}
  onExportProfileIdChange={setExportProfileId}
  runtimeExportOverrides={runtimeExportOverrides}
  suggestedZipName={suggestedZipName}
  exportFileNames={exportFileNames}
  hasChannels={hasChannels}
  interchangeFolderId={interchangeFolderId}
  reloadEgressPaths={reloadEgressPaths}
/>
```

## Behaviour

- Opens on **Checks** when there is no export choice; CHIRP and NeonPlug open on **What to export** first.
- `checkCpsExport` runs on Checks (and when CHIRP profile or NeonPlug donor changes).
- Delivery buttons call existing `buildCpsExportService` download/upload helpers.
- Errors use `ErrorPanel` with title “The export failed” and retry “Try again”.
- Warnings are computed per open; they do not accumulate across opens.

## Related

- [Import/export hub](../../../../docs/features/import-export/README.md)
- [`ExportBuildCpsPanel`](../ExportBuildCpsPanel.md)
- [`EgressShell`](../../egress/EgressShell/EgressShell.md)
