# ExportBuildCpsPanel

Per-build CPS export on the Export for radio detail page — per-file CSV downloads, ZIP archive download, and Google Drive ZIP upload.

## Props

| Prop    | Type         | Description                                              |
| ------- | ------------ | -------------------------------------------------------- |
| `build` | `RadioBuild` | Active radio build (wire names, layout, export settings) |

Requires `useBuildLayout()` — `formatId` / `profileId` come from the **active egress pathway**, not the build row.

## Behaviour

- **Radio-level settings first** — Inclusion / Naming / Scanning (`ExportBuildSettingsSections`) render above the pathway chooser. Visibility and fill-in defaults key off catalog **`radioTargetId`** (traits + default compatible egress), not the active pathway — switching CHIRP ↔ NeonPlug ↔ Web Serial must not flip projection controls ([#658](https://github.com/pskillen/codeplug-studio/issues/658)).
- **Export pathway** — when multiple `EgressPath` rows exist, a **SegmentedControl** sits below those settings (session + `defaultEgressPathId`). Catalog order prefers Web Serial when available.
- Pathway-specific chrome (CHIRP profile picker, NeonPlug donor merge, Web Serial Connect/Read/Write, download buttons, pathway wire-name caps) follows the switcher.
- CHIRP keeps a runtime **export profile** override (`ProfilePicker`) within the CHIRP egress only; non-CHIRP ids are ignored via `resolveChirpExportProfileId`.
- Disables export actions when the project library has no channels.
- Shows export warnings returned by the format adapter (profile limits, name length, etc.).
- **DM32** (`formatId === 'dm32'`): mounts `Dm32PreferNeonPlugAlert` once after the pathway switcher — orange deprecation of native Baofeng DM-32 CPS CSV for radio write (**Export only**, not New Radio). Conditional `Dm32AprsSetupAlert` when `APRS.md` is in the export file list. Downloads stay enabled.
- No soft “try NeonPlug” tips on CHIRP / Web Serial — those pathways are siblings under the same radio build.
- **Download ZIP** packages all CPS CSV files via `buildCpsExportService.downloadCpsZip` (includes conditional files when the adapter adds them, e.g. Anytone `AMAir.CSV` / `FM.CSV`, plus Anytone `{projectSlug}.LST` manifest when project name is set).
- **Individual files** trigger `downloadCpsFile` per **effective** export file list (`listCpsExportFileNames` / `resolveEffectiveExportFileNames`) — not the static adapter `fileNames` when a format appends conditional banks or sidecars (e.g. `.LST`).
- **Save ZIP to Drive** opens `DriveBrowserModal` in save mode (`saveConflictKind: zip`) and uploads via `uploadCpsZipToDrive`.
- **Preview CSV** (`variant="outline"`, after Save ZIP to Drive) opens `CpsCsvPreviewModal` — tabbed read-only tables via `previewCpsExport` / `exportBuildAll` (lazy while modal is open). Tab list matches the effective export file set returned by preview.
- Export settings are grouped in bordered **Inclusion**, **Naming**, and **Scanning** cards (`FieldCard` — Mantine `Paper`, theme-aware).
- Planned formats (`exportStatus !== 'shipped'`) show a grey alert instead of actions.

### NeonPlug dual pathway

When the active egress `formatId === 'neonplug'`:

1. **Primary — Download for radio write:** upload a radio-read donor `.neonplug`, then download/save a merge that overwrites Studio-modelled arrays while retaining donor settings, `radioIds`, and ancillaries.
   - Successful upload persists retain slices on the **active egress** `hydration` via `putEgressPath` so later exports can merge without re-uploading. Clear stored donor from the export panel. Session upload still overrides the stored bag for that export.
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
- [`preferNeonPlugPathwayBadges.md`](preferNeonPlugPathwayBadges.md) — DM32 / NeonPlug pathway pills
- [`CpsCsvPreview.md`](CpsCsvPreview.md) — tabbed CSV preview modal
- [`docs/features/builds/README.md`](../../../../docs/features/builds/README.md) — build export workflow
- [`docs/features/import-export/neonplug/README.md`](../../../../docs/features/import-export/neonplug/README.md) — NeonPlug merge-first export
