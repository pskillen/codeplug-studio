# ExportBuildCpsPanel

Per-build CPS export on the Export for radio detail page — per-file CSV downloads, ZIP archive download, and Google Drive ZIP upload.

## Props

| Prop    | Type          | Description                                   |
| ------- | ------------- | --------------------------------------------- |
| `build` | `FormatBuild` | Active format build (format, profile, layout) |

## Behaviour

- Uses the build’s **saved** `profileId` from the Target section (no export-time profile override).
- Disables export actions when the project library has no channels.
- Shows export warnings returned by the format adapter (profile limits, name length, etc.).
- **DM32** (`formatId === 'dm32'`): always shows `Dm32PreferNeonPlugAlert` (orange — prefer NeonPlug for radio write) above the conditional `Dm32AprsSetupAlert` when `APRS.md` is in the export file list. Downloads stay enabled.
- **CHIRP UV-5R** (`formatId === 'chirp'` and export profile `chirp-uv5r`): shows `ChirpUv5rPreferNeonPlugAlert` (yellow — CHIRP in progress; prefer NeonPlug). Gate uses export-time `exportProfileId`, not only `build.profileId`.
- **Download ZIP** packages all CPS CSV files via `buildCpsExportService.downloadCpsZip` (includes conditional files when the adapter adds them, e.g. Anytone `AMAir.CSV` / `FM.CSV`, plus Anytone `{projectSlug}.LST` manifest when project name is set).
- **Individual files** trigger `downloadCpsFile` per **effective** export file list (`listCpsExportFileNames` / `resolveEffectiveExportFileNames`) — not the static adapter `fileNames` when a format appends conditional banks or sidecars (e.g. `.LST`).
- **Save ZIP to Drive** opens `DriveBrowserModal` in save mode (`saveConflictKind: zip`) and uploads via `uploadCpsZipToDrive`.
- **Preview CSV** (`variant="outline"`, after Save ZIP to Drive) opens `CpsCsvPreviewModal` — tabbed read-only tables via `previewCpsExport` / `exportBuildAll` (lazy while modal is open). Tab list matches the effective export file set returned by preview.
- Export settings are grouped in bordered **Inclusion**, **Naming**, and **Scanning** cards (`FieldCard` — Mantine `Paper`, theme-aware).
- Planned formats (`exportStatus !== 'shipped'`) show a grey alert instead of actions.

### NeonPlug dual pathway

When `build.formatId === 'neonplug'`:

1. **Primary — Download for radio write:** upload a radio-read donor `.neonplug`, then download/save a merge that overwrites Studio-modelled arrays while retaining donor settings, `radioIds`, and ancillaries.
   - **DM32UV (`neonplug-dm32uv`):** successful upload also persists retain slices on `build.cpsWireHydration` so later exports can merge without re-uploading (and native YAML project export/import carries the bag). Clear stored donor from the export panel. Session upload still overrides the stored bag for that export.
   - **UV5R-Mini:** donor stays session-only until a later ticket.
   - Primary download and Drive save stay disabled until a session donor **or** (DM32UV) stored `cpsWireHydration` is present.
2. **Secondary — Download greenfield `.neonplug`:** smaller subtle control with a yellow warning that greenfield omits radio settings and is **not safe to write back** without a donor base.

CSV preview and per-file buttons are hidden for NeonPlug (single `codeplug.json` package).

## Usage

```tsx
import ExportBuildCpsPanel from '../../components/builds/ExportBuildCpsPanel.tsx';

<ExportBuildCpsPanel build={build} />;
```

## Related

- [`buildCpsExportService.ts`](../../services/buildCpsExportService.ts) — assemble + export + download/Drive/preview wiring
- [`useBuildCpsExportFileNames.ts`](../../hooks/useBuildCpsExportFileNames.ts) — effective per-file export list for Individual files buttons
- [`Dm32PreferNeonPlugAlert.md`](Dm32PreferNeonPlugAlert.md) — DM32 → NeonPlug deprecation alert
- [`ChirpUv5rPreferNeonPlugAlert.md`](ChirpUv5rPreferNeonPlugAlert.md) — CHIRP UV-5R soft prefer-NeonPlug hint
- [`CpsCsvPreview.md`](CpsCsvPreview.md) — tabbed CSV preview modal
- [`docs/features/builds/README.md`](../../../../docs/features/builds/README.md) — build export workflow
- [`docs/features/import-export/neonplug/README.md`](../../../../docs/features/import-export/neonplug/README.md) — NeonPlug merge-first export
