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

- **Channels** — `channelSelections` order with `overrides.name` as wire name; when selections are empty, all library channels are included.
- **Zones** — `layout.sections` zone grouping cross-referenced with library `Zone` rows and `zoneSelections` wire names; falls back to library zone membership when layout is empty.
- **Contacts / talk groups / RX lists** — explicit selections when populated; otherwise entities referenced by exported channels (including RX list members).

Wire adapters read `AssembledBuild` — they do not query IndexedDB or parse CPS.

## exportBuild

- `exportBuildFile({ build, library, fileName, options })` — one CPS file.
- `exportBuildAll({ build, library, options })` — all files for the format adapter.

`options.profileId` overrides the build's saved profile for wire limits without mutating the build row.

## Related

- [mapping-tests](../../build/testing/mapping-tests.md)
- [import-export/opengd77](opengd77/README.md)
- [DESIGN.md](../../../DESIGN.md) — export as projection
