# CPS export services

Application services between build UI and format export adapters.

**Tracking:** [#86](https://github.com/pskillen/codeplug-studio/issues/86) · Epic [#36](https://github.com/pskillen/codeplug-studio/issues/36)

**Source:** `src/core/services/assemble.ts`, `src/core/services/exportBuild.ts`

## Export path

```text
FormatBuild + library rows
  → assemble(build, library)
  → AssembledBuild (export projection)
  → getExportAdapter(formatId).serialiseFile(...)
  → CPS CSV content + warnings
```

`importIntoLibrary` (CPS import → library + build) ships in Phase 4b — not here.

## assemble

`assemble(build, library, options?)` returns an **export projection**:

- **Channels** — non-excluded library channels; when `exportUnlinkedChannels` is false, only channels linked in build zone layout or library zones.
- **Zones** — `layout.sections` zone grouping cross-referenced with library `Zone` rows and `zoneOverrides` wire names; falls back to library zone membership when layout is empty.
- **Contacts / talk groups / RX lists** — referenced by exported channels (including RX list members); when `exportUnlinkedTalkGroups` / `exportUnlinkedRxGroupLists` are true (default), all non-excluded library rows of that kind are also included.

`exportInclusionWarnings(build, library, assembled)` reports counts when orphan entities are included.

Wire adapters read `AssembledBuild` — they do not query IndexedDB or parse CPS.

## exportBuild

- `exportBuildFile({ build, library, fileName, options })` — one CPS file.
- `exportBuildAll({ build, library, options })` — all files for the format adapter.

App-layer `previewCpsExport` in `buildCpsExportService.ts` calls `exportBuildAll` without triggering a browser download; the build export page modal parses results with `csvToTable` for on-screen preview ([#151](https://github.com/pskillen/codeplug-studio/issues/151)).

`options.profileId` overrides the build's saved profile for wire limits without mutating the build row.

## Related

- [mapping-tests](../../build/testing/mapping-tests.md)
- [import-export/opengd77](opengd77/README.md)
- [DESIGN.md](../../../DESIGN.md) — export as projection
