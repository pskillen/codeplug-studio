# ExportBuildCpsPanel

Per-build CPS export on the Export for radio detail page — per-file CSV downloads, ZIP archive download, and Google Drive ZIP upload.

## Props

| Prop    | Type         | Description                                              |
| ------- | ------------ | -------------------------------------------------------- |
| `build` | `RadioBuild` | Active radio build (wire names, layout, export settings) |

Requires `useBuildLayout()` — `formatId` / `profileId` come from the **active egress pathway**, not the build row.

## Behaviour

- Uses the **active egress pathway** from build layout context (`formatId` + `profileId` on `EgressPath`).
- When a build has multiple compatible egress pathways, a **SegmentedControl** switches the active pathway (session-persisted via layout).
- CHIRP keeps a runtime **export profile** override (`ProfilePicker`) within the CHIRP egress only.
- Disables export actions when the project library has no channels.
- Shows export warnings returned by the format adapter (profile limits, name length, etc.).
- **DM32** (`formatId === 'dm32'`): mounts `Dm32PreferNeonPlugAlert` twice — top of the panel (above the fold) and just above the download buttons. Orange — prefer NeonPlug for radio write. Conditional `Dm32AprsSetupAlert` when `APRS.md` is in the export file list. Downloads stay enabled.
- **CHIRP UV-5R** (`formatId === 'chirp'` and export profile `chirp-uv5r`): mounts `ChirpUv5rPreferNeonPlugAlert` twice — top of the single-file stack and just above **Download CSV**. Blue info — optional NeonPlug browser pathway; does not urge leaving CHIRP CSV. Gate uses resolved CHIRP export profile (`resolveChirpExportProfileId`), never a NeonPlug / Web Serial `profileId` left over from pathway switching.
- Switching away from CHIRP and back must not crash: CHIRP export-profile state is only reset when entering a CHIRP egress, and non-CHIRP ids are ignored via `resolveChirpExportProfileId`.
- **Download ZIP** packages all CPS CSV files via `buildCpsExportService.downloadCpsZip` (includes conditional files when the adapter adds them, e.g. Anytone `AMAir.CSV` / `FM.CSV`, plus Anytone `{projectSlug}.LST` manifest when project name is set).
- **Individual files** trigger `downloadCpsFile` per **effective** export file list (`listCpsExportFileNames` / `resolveEffectiveExportFileNames`) — not the static adapter `fileNames` when a format appends conditional banks or sidecars (e.g. `.LST`).
- **Save ZIP to Drive** opens `DriveBrowserModal` in save mode (`saveConflictKind: zip`) and uploads via `uploadCpsZipToDrive`.
- **Preview CSV** (`variant="outline"`, after Save ZIP to Drive) opens `CpsCsvPreviewModal` — tabbed read-only tables via `previewCpsExport` / `exportBuildAll` (lazy while modal is open). Tab list matches the effective export file set returned by preview.
- Export settings are grouped in bordered **Inclusion**, **Naming**, and **Scanning** cards (`FieldCard` — Mantine `Paper`, theme-aware).
- Planned formats (`exportStatus !== 'shipped'`) show a grey alert instead of actions.

### NeonPlug dual pathway

When `build.formatId === 'neonplug'`:

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
- [`ChirpUv5rPreferNeonPlugAlert.md`](ChirpUv5rPreferNeonPlugAlert.md) — CHIRP UV-5R NeonPlug pathway FYI
- [`preferNeonPlugPathwayBadges.md`](preferNeonPlugPathwayBadges.md) — New build format/profile pills
- [`CpsCsvPreview.md`](CpsCsvPreview.md) — tabbed CSV preview modal
- [`docs/features/builds/README.md`](../../../../docs/features/builds/README.md) — build export workflow
- [`docs/features/import-export/neonplug/README.md`](../../../../docs/features/import-export/neonplug/README.md) — NeonPlug merge-first export
