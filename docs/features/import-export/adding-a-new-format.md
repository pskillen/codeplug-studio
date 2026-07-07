# Adding a new CPS import/export format

Canonical checklist for contributors shipping a **new radio interchange format** (OpenGD77 CSV, DM32 CSV, CHIRP CSV, qDMR YAML, …) in Codeplug Studio.

The internal [library + format build model](../data-model/README.md) is the hub — format specifics are applied on import and projected on export. **Native YAML** is Studio's own lossless project interchange; this guide focuses on **external CPS formats** but notes where the same adapter patterns apply.

**Reference implementations today:**

| Format       | Import  | Export  | Adapter path                                  |
| ------------ | ------- | ------- | --------------------------------------------- |
| OpenGD77 CSV | Planned | Shipped | `src/core/import-export/formats/opengd77/`    |
| DM32 CSV     | Planned | Shipped | `src/core/import-export/formats/dm32/`        |
| CHIRP CSV    | Planned | Shipped | `src/core/import-export/formats/chirp/`       |
| Native YAML  | Shipped | Shipped | `src/core/import-export/formats/native-yaml/` |

---

## When to add what

| Situation                                                           | What to build                                                                                                                                                                    |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **New format** (e.g. CHIRP CSV, qDMR YAML)                          | Import and/or export adapters, tier-3 reference docs, trait profile, radio profiles, fixtures, tests, `formatCatalog` entry, build UI wiring                                     |
| **New radio on an existing format** (e.g. another OpenGD77 variant) | Tier-3 [radio profile](../../reference/opengd77/radios/README.md) doc + row in `formats/<format>/profiles.ts` — export limits at profile picker only; adapter stays format-level |

Do **not** bake radio profile caps into library mutations, validation, or CRUD UI. See [AGENTS.md — Vendor boundaries](../../../AGENTS.md#vendor-boundaries).

### Export source of truth (no wire stash)

Import maps CPS wire values into **typed library and build fields**. Export serialises **from those fields** after `assemble(build, library)` — not from import provenance or stashed wire cells.

**Forbidden:** `wireColumns`, per-column `*Wire` replay bags, or opaque format extras used to pass round-trip tests. If fidelity fails, extend the model and fix boundary mappers, or document the column as lossy in tier-3 reference docs.

See [export-from-model.mdc](../../../.cursor/rules/export-from-model.mdc) and [DESIGN.md — Testing](../../../DESIGN.md#testing).

---

## Architecture overview

Studio separates **what operators curate** (library), **how a target radio organises it** (format build + traits), and **how CPS files encode it** (wire adapters).

```text
CPS files ──import──► library entities (+ optional build trait layout)
                              │
FormatBuild (traits, selections, overrides)
                              │
                    assemble(build, library)
                              │
                      AssembledBuild
                              │
              format serialise.ts (+ expansion, derive)
                              │
                      CSV / YAML / ZIP download
```

Routes and UI call **application services** — not adapters directly:

| Service                                                 | Path                                     | Role                                  |
| ------------------------------------------------------- | ---------------------------------------- | ------------------------------------- |
| `assemble`                                              | `src/core/services/assemble.ts`          | Vendor-neutral export projection      |
| `exportBuildFile` / `exportBuildAll` / `exportBuildZip` | `src/core/services/exportBuild.ts`       | CPS serialisation + ZIP               |
| `previewWireRows`                                       | `src/core/services/previewWireRows.ts`   | Wire preview tables (expansion-aware) |
| `importProjectYaml`                                     | `src/core/services/importProjectYaml.ts` | Native YAML → IndexedDB               |
| `importIntoLibrary`                                     | _(planned Phase 4b)_                     | CPS batch → library + build           |

Full export path: [cps-services.md](cps-services.md).

### Library vs build vs format

| Concern                                         | Layer                                       | Examples                                                           |
| ----------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------ |
| RF semantics (frequency, mode, TG ref)          | Library `Channel`, `TalkGroup`, …           | Shared across all builds                                           |
| Which entities participate + wire names         | `FormatBuild` selections + `overrides.name` | Per-build CPS labels                                               |
| Organisation (zones, scan lists, flat memories) | `FormatBuild.layout` (trait-shaped)         | OpenGD77 zones vs CHIRP flat list                                  |
| Zone membership (channels + nested zones)       | Library `Zone.members`                      | `kind: 'channel'` / `kind: 'zone'`                                 |
| Omit standalone zone row on export              | Library `Zone.omitFromExport`               | Nested building blocks                                             |
| Per-build zone wire name / exclude              | `FormatBuild.zoneOverrides`                 | `excluded`, `wireName`                                             |
| Format-only zone flags                          | `ZoneGroupingLayout` on build               | DM32 `exportScanList`, `scanCarrierFrequencyHz`                    |
| Per-member scan list filter                     | Library `ZoneMemberEntry.includeInScanList` | DM32 zone-derived scan only                                        |
| Channel scan inclusion                          | Library `Channel.scanInclusion`             | Tri-state; see [scan-inclusion](../../reference/scan-inclusion.md) |
| Export-affecting prefs                          | `FormatBuild.exportSettings`                | Name shortening, default scan behaviour, DM32 scan master          |
| Format scan default                             | Adapter `defaultExportSettings`             | e.g. CHIRP `skip`, OpenGD77/DM32 `scan`                            |

**Rule for serialisers:** consume `AssembledBuild` — especially `zones[].memberChannelIds` (flat UUID lists). Do **not** re-walk library nesting or `ZoneGroupingLayout.channelIds` as membership source of truth; `assemble` already flattened effective membership.

If the format needs derived artefacts (DM32 zone-derived `Scan.csv`), add a **derive** step between assemble and serialise (see `src/core/import-export/zoneDerivedScanLists/derive.ts`) rather than pushing hierarchy logic into the adapter.

Nested zone semantics: [nested-zones.md](../library/nested-zones.md).

---

## 1. Reference docs (tier 3)

Wire-format ground truth lives under `docs/reference/<format>/` — separate from adapter **behaviour** docs under `docs/features/import-export/<format>/`.

Per [documentation-boundaries.mdc](../../../.cursor/rules/documentation-boundaries.mdc): **no wire-mapping tables** in tier-1 feature docs or tier-2 domain docs — link out only.

- [ ] Create `docs/reference/<format>/README.md` hub — file list, FK rules, skip-vs-error table
- [ ] One page per CPS file or logical grouping (channels, zones, contacts, scan lists, …)
- [ ] Document **lossy fields** (header-only files, columns not modelled, genuinely unmapped columns)
- [ ] If one format serves many radios, add `docs/reference/<format>/radios/` for per-radio limits
- [ ] Cite ground-truth sources (vendor CPS exports, community docs, reverse-engineered samples)
- [ ] Document expansion choices: multi-mode rows, multi-talkgroup fan-out, zone member wire naming

OpenGD77 example: [reference/opengd77/](../../reference/opengd77/README.md). DM32: [reference/dm32/](../../reference/dm32/README.md).

---

## 2. Code layout

### Shared contracts and registry

All formats share `src/core/import-export/`:

| File                      | Role                                                                     |
| ------------------------- | ------------------------------------------------------------------------ |
| `types.ts`                | `FormatId`, `FormatCatalogEntry`, `CpsExportOptions`, `ImportEntityKind` |
| `importAdapter.ts`        | `SingleFileProjectImportAdapter` \| `MultiFileImportAdapter`             |
| `exportAdapter.ts`        | `SingleFileProjectExportAdapter` \| `MultiFileExportAdapter`             |
| `registry.ts`             | `formatCatalog`, `importAdapters`, `exportAdapters`, getters             |
| `formatProfiles.ts`       | UI-facing radio profile list + wire hints                                |
| `adapterContract.test.ts` | Each shipped adapter satisfies its interface                             |
| `channelExpansion/`       | Shared multi-mode, multi-TG, name shortening                             |
| `zoneDerivedScanLists/`   | DM32-style zone → scan list derivation                                   |

### Delivery variants

| `delivery`        | Import                    | Export           | Typical formats |
| ----------------- | ------------------------- | ---------------- | --------------- |
| `multi-file`      | Folder or loose CSV batch | Per-file + ZIP   | OpenGD77, DM32  |
| `single-file-cps` | One memory CSV            | One CSV download | CHIRP           |

Native YAML uses `single-file` **project** adapters (`parseDocument` / `serialise(aggregate)`) — full library + all builds in one file.

### Per-format directory

```
src/core/import-export/formats/<format>/
  adapter.ts       # satisfies ImportAdapter and/or ExportAdapter
  profiles.ts      # radio variant limits (export boundary only)
  columns.ts       # header constants (shared import/export)
  parse.ts         # wire row → library entities (import)
  serialise.ts     # AssembledBuild → CPS files (export)
  channelWire.ts   # per-channel column mapping
  listWire.ts      # zones / RX group lists member wire names
  exportRefs.ts    # UUID → wire name denormalisation
  warnings.ts      # profile cardinality / inclusion warnings
  csvWrite.ts      # RFC 4180 write helper
  packageZip.ts    # ZIP builder (if multi-file)
  __fixtures__/    # golden import/export files (preferred)
```

### Registration checklist

- [ ] Add `FormatId` union member in `types.ts`
- [ ] Add `FormatCatalogEntry` row in `registry.ts` (`importStatus` / `exportStatus`)
- [ ] Register adapter in `importAdapters` and/or `exportAdapters`
- [ ] Add `TraitProfile` in `src/core/models/traits.ts` — drives build UI composition
- [ ] Add radio profiles in `formats/<format>/profiles.ts`
- [ ] Extend `getFormatProfiles()` in `formatProfiles.ts` + `formatProfileWireHint` if needed
- [ ] Wire ZIP packaging in `exportBuild.ts` if not following OpenGD77/DM32 pattern

Use `satisfies ImportAdapter` / `satisfies MultiFileExportAdapter` (or single-file variants) on adapter objects.

### Export settings and scan defaults ([#203](https://github.com/pskillen/codeplug-studio/issues/203))

| Storage                             | What                                                 | Examples                                                             |
| ----------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------- |
| **Adapter** `defaultExportSettings` | Format-level defaults when build omits a value       | `defaultScanInclusion`, `expandModes`, `expandRxGroupLists`          |
| **`FormatBuild.exportSettings`**    | Per-build operator choices (IndexedDB + native YAML) | `defaultScanInclusion`, `shortenNames`, `exportZoneDerivedScanLists` |
| **Browser `localStorage`**          | Visual-only prefs                                    | Wire-preview hide filter, column visibility                          |

Register defaults on the export adapter and in `getFormatExportDefaults()` for planned formats without a shipped adapter (e.g. CHIRP).

`mergeExportOptions(build)` in `exportSettingsMerge.ts` merges adapter defaults → build `exportSettings` → runtime overrides.

**Scan inclusion:** library `Channel.scanInclusion` (`default` \| `skip` \| `alwaysScan`). Resolve at serialise with `resolveEffectiveScanInclusion()` — do not read legacy `scanSkip` in adapters. See [scan-inclusion](../../reference/scan-inclusion.md).

- [ ] Set `defaultExportSettings.defaultScanInclusion` on adapter (CHIRP: `skip`; most others: `scan`)
- [ ] Wire serialiser through shared scan helpers in `src/core/import-export/scanInclusion/`
- [ ] Export panel: `DefaultScanInclusionSegment` for build override
- [ ] Directional mapper tests for wire column ↔ `scanInclusion`

### Import adapter contract

**Multi-file CPS** (`MultiFileImportAdapter`):

- `detectKind(fileName, headerRow)` — classify each uploaded file
- `capabilities.entityKinds` — which parsers exist (`channels`, `zones`, `contacts`, …)
- Per-entity parse functions (extend the interface as Phase 4b lands — today `parseChannels` is the typed placeholder)
- Return structured `ImportResult` with errors, skipped files, and `formatId`
- Map wire names → UUID refs at the boundary; never persist name-based FKs in the library model

**Single-file project** (`SingleFileProjectImportAdapter`):

- `parseDocument(text)` → `ImportDocumentResult` with full `ProjectAggregate`

### Export adapter contract

**Multi-file CPS** (`MultiFileExportAdapter`):

- `fileNames` — ordered CPS file list
- `serialiseFile(assembled, fileName, options?)` → `{ content, warnings }`
- Apply `CpsExportOptions.profileId` radio limits; options override build defaults without mutating the build row
- Normalise wire strings to printable ASCII via `sanitiseAsciiWireString.ts` where applicable

**Single-file CPS** (`SingleFileCpsExportAdapter` — shipped for CHIRP):

- `defaultFileName(profileId)` — suggested download name
- `serialise(assembled, options?)` → `{ content, warnings }`
- App path: `exportBuildSingleFile` → `downloadCpsSingleFile` / `previewCpsSingleFile`

---

## 3. Build capability traits

Each format build is created from a **trait profile** (`TRAIT_PROFILES` in `src/core/models/traits.ts`). Traits compose build UI and `FormatBuild.layout` — they are **not** CPS column names.

| `profileId`                        | `formatId` | Traits (shipped)                                             |
| ---------------------------------- | ---------- | ------------------------------------------------------------ |
| `opengd77-1701`, `opengd77-md9600` | `opengd77` | `ZoneGrouping`, `ZoneAsScanList`, `MultiTalkGroupPerChannel` |
| `dm32-baofeng-dm32uv`              | `dm32`     | `ZoneGrouping`, `ScanLists`, `MxNChannelExpansion`           |
| `chirp-uv5r`                       | `chirp`    | `FlatMemoryList`, `PerChannelScanFlag`                       |

**Two profile registries** share `profileId` keys where both exist:

1. **Trait profile** — build nav, zone grouping pages, scan UI (`src/app/routes/builds/nav.ts`)
2. **Radio profile** — export limits only (`nameLimit`, `maxChannels`, power ladders in `formats/<format>/profiles.ts`)

When adding a format:

- [ ] Define traits that match how operators organise channels for that radio family
- [ ] Implement trait UI under `src/app/features/builds/` (reuse shared trait modules — do not fork OpenGD77-only UI)
- [ ] Ensure `assemble` reads the trait layout your serialiser expects
- [ ] Document trait ↔ wire mapping in `docs/features/import-export/<format>/README.md` (behaviour, not column tables)

See [DESIGN.md — Build capability traits](../../../DESIGN.md#build-capability-traits) and [builds hub](../builds/README.md).

---

## 4. Expandable channels

The library lets operators keep **fewer logical channels** than some CPS formats require on the wire. Shared expansion lives in `src/core/import-export/channelExpansion/` — each format adapter decides **which axes apply**.

| Question                                                                                  | If yes on wire                                                                            | If no on wire                                                                           |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Dual / multi RF mode** on one channel row? (e.g. DM32 `Fixed Analog` / `Fixed Digital`) | Map to `multiMode` + `modeProfiles` on import; **do not** mode-expand on export           | Mode-expand on export — separate rows per profile (`-F`, `-D`, …). **OpenGD77 default** |
| **Promiscuous RX / RX group lists**? (e.g. OpenGD77 `TG List` + `TG_Lists.csv`)           | Lean export — one channel row + list reference; import maps list members to `RxGroupList` | Multi-talkgroup expansion — one row per (channel × talk group). **DM32 default**        |

Neither axis is automatic — **document the choice** in `docs/reference/<format>/` and the format behaviour README.

### Export pipeline (when expansion applies)

```text
AssembledBuild.channels
  → expandChannelWireRows / expandAllDm32ChannelsForExport (format-specific)
  → expanded wire rows
  → serialise each row to vendor columns
```

`CpsExportOptions` flags (set defaults in export UI per format):

| Option                         | Typical use                                          |
| ------------------------------ | ---------------------------------------------------- |
| `expandModes`                  | `true` OpenGD77; `false` DM32 (native dual-mode row) |
| `expandRxGroupLists`           | `false` OpenGD77; `true` DM32                        |
| `expandRxGroupListMembers`     | `'all'` \| `'talkGroupsOnly'`                        |
| `multiTalkGroupExportNameMode` | Wire naming for fan-out rows                         |
| `exportZoneDerivedScanLists`   | DM32 zone → `Scan.csv` synthesis                     |

Zone members: use format-specific `expandZoneMemberWireNames` so logical channel ids fan out to **expanded wire names** (multi-mode and multi-TG aware). Warn/truncate at profile caps in `warnings.ts`.

### Import pipeline (best-effort collapse)

After parsing flat channel rows, run shared merge helpers when the format may emit multiple rows per logical channel:

- Multi-mode paired rows → one `multiMode` channel
- Same-site digital rows differing only by TX talk group → one logical channel + RX group list

Collapse is **best-effort** — ambiguous groups stay flat until the operator merges manually.

### Per-format checklist

- [ ] Document mode expansion, TG expansion, both, or neither
- [ ] Link tier-2 rules: [multi-talkgroup-expansion.md](../../reference/multi-talkgroup-expansion.md), [channel-modes.md](../../reference/channel-modes.md)
- [ ] Wire export through the correct expansion helpers; mirror logic in `previewWireRows.ts` for wire preview parity
- [ ] Tests: expanded row count, zone fan-out, naming collisions, import collapse
- [ ] Do **not** add per-channel expansion flags to the library model — boundary concern only

Domain background: [data-model](../data-model/README.md), [name-shortening.md](name-shortening.md).

---

## 5. Data model

Extend the library model only when a field is **shared across formats** or needed for app features (map, CRUD, reports).

| Extend library entities                               | Keep at format boundary                                        |
| ----------------------------------------------------- | -------------------------------------------------------------- |
| Channel mode, frequency, contact ref, zone membership | Vendor-specific column with no cross-format semantics          |
| Talk group, contact, RX group list semantics          | Columns that round-trip but have no UI yet — document as lossy |

- [ ] Read [data-model/README.md](../data-model/README.md) before adding fields
- [ ] Round-trip via **model fields**, not wire stash
- [ ] Bump persistence schema version + migration if entity shape changes (`src/integrations/`)
- [ ] **UUID FK rules:** `memberChannelIds`, contact refs, RX-list refs — resolve wire names at import/export edge only
- [ ] Do not cap entity counts in library CRUD — defer to export with warnings/truncation

---

## 6. Tests

Primary quality gate: **directional mapping tests**, not full round-trip equality. See [mapping-tests.md](../../build/testing/mapping-tests.md).

| Scenario               | Layer                      | Required for new format                             |
| ---------------------- | -------------------------- | --------------------------------------------------- |
| Import mapping         | Unit beside `parse.ts`     | Yes (when import ships)                             |
| Export mapping         | Unit beside `serialise.ts` | Yes (when export ships)                             |
| Assemble               | `assemble.test.ts`         | When trait layout affects projection                |
| Wire preview           | `previewWireRows.test.ts`  | When expansion or overrides differ from defaults    |
| Adapter contract       | `adapterContract.test.ts`  | Yes                                                 |
| Same-format round-trip | Optional smoke             | Secondary — diagnose failures via directional tests |
| Cross-format           | Adapter matrix golden      | When second format pair is meaningful               |

### Checklist

- [ ] Parse by **header name**, never column index
- [ ] `adapterContract.test.ts`: metadata, `capabilities`, delivery type guards
- [ ] Committed fixtures under `formats/<format>/__fixtures__/` or `src/test/<format>/` — see [fixtures.md](../../build/testing/fixtures.md)
- [ ] Export golden: constructed library + `FormatBuild` in memory → expected CSV rows
- [ ] Import golden: CPS fixture → expected library JSON (+ build layout when applicable)
- [ ] Fill adapter matrix row in [mapping-tests.md](../../build/testing/mapping-tests.md)
- [ ] Document excluded columns in tests (export-reassigned or lossy fields)

```bash
npm run test        # Vitest — colocated *.test.ts
npm run lint        # ESLint
npm run format:check
npm run build       # when types or build config change
```

Use `sample-exports/` locally for manual realism (gitignored — do not commit operator codeplugs).

---

## 7. UI — full feature coverage

Studio surfaces formats in **three places**: project interchange (`/import-export`), **build creation**, and **per-build export / wire preview**. A shipped export adapter is not complete until all relevant UI paths work.

### Format catalog (`/import-export`)

| Component    | Path                       | Checklist                                                       |
| ------------ | -------------------------- | --------------------------------------------------------------- |
| CPS grid     | `CpsFormatCatalogGrid.tsx` | Auto-lists `formatCatalog` (excludes `native-yaml`)             |
| Format card  | `FormatCatalogPanel.tsx`   | Shows import/export badges from `importStatus` / `exportStatus` |
| Import route | `ImportExportPage.tsx`     | Native YAML panels + CPS grid                                   |
| Deep link    | `useFormatParam.ts`        | `?format=<id>` highlights catalog card                          |

- [ ] `formatCatalog` row with correct `importStatus` / `exportStatus`
- [ ] Planned import shows "coming soon" — do not register import adapter until ready
- [ ] When import ships: file picker + batch upload wired through planned `importIntoLibrary` service

### Build creation and navigation

| Component      | Path                           | Checklist                                                |
| -------------- | ------------------------------ | -------------------------------------------------------- |
| New build      | `NewBuildPage.tsx`             | Lists CPS formats from `formatCatalog`                   |
| Profile picker | `ProfilePicker.tsx`            | `buildProfileOptionsForFormat` + `formatProfileWireHint` |
| Build nav      | `src/app/routes/builds/nav.ts` | Trait-driven sections (zones, channels, scan lists, …)   |

- [ ] `TraitProfile` registered — build wizard creates valid empty `layout`
- [ ] Trait pages implemented or explicitly deferred with hub doc **Known gaps**
- [ ] `profileId` on new `FormatBuild` resolves in both trait and radio registries

### Build export (`/builds/:id/export`)

| Component       | Path                                                      | Checklist                                                                                |
| --------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Export panel    | `ExportBuildCpsPanel.tsx`                                 | Gated on `exportStatus === 'shipped'`                                                    |
| App service     | `buildCpsExportService.ts`                                | `previewCpsExport`, `downloadCpsZip`, Drive upload                                       |
| CSV preview     | `CpsCsvPreviewModal.tsx`                                  | Tabbed per-file preview ([#151](https://github.com/pskillen/codeplug-studio/issues/151)) |
| Export settings | `ExportNameSettingsFields`, `DefaultScanInclusionSegment` | `FormatBuild.exportSettings` + adapter `defaultExportSettings`                           |

- [ ] Per-file download + ZIP for `multi-file` adapters
- [ ] Profile override in export UI (does not mutate build row)
- [ ] Warnings surfaced from adapter `warnings` arrays
- [ ] Format-specific export toggles (DM32: scan list export, multi-TG options, hide filter)

### Wire preview (`/builds/:id/channels`, talk groups, zones, …)

| Component    | Path                     | Checklist                                       |
| ------------ | ------------------------ | ----------------------------------------------- |
| Preview hook | `useBuildWirePreview.ts` | Loads library + applies export settings         |
| Row builder  | `previewWireRows.ts`     | **Must mirror export expansion** for the format |
| Table        | `WirePreviewTable.tsx`   | Override editing, fan-out display               |

- [ ] Add or extend format branch in `previewWireRows.ts` when expansion differs from OpenGD77 defaults
- [ ] Wire name overrides from `FormatBuild` reflected in preview rows
- [ ] Multi-mode / multi-TG fan-out visible before export

### Google Drive (optional)

Native YAML and CPS ZIP export can upload via [google-drive.md](google-drive.md). If the format exports ZIP, confirm Drive path in `buildCpsExportService.ts`.

---

## 8. Lossy fields

Document and test known non-round-trip behaviour in tier-3 reference + format behaviour README:

- [ ] Skipped files on import (e.g. DTMF/APRS when not modelled)
- [ ] Header-only export for unmodelled CPS files
- [ ] App-only library fields absent from CPS (e.g. map visibility flags)
- [ ] Columns genuinely not in the internal model — listed explicitly, not faked with stash
- [ ] Nested zones denormalise to flat wire lists — nesting is Studio-only
- [ ] `Zone.omitFromExport` — Studio export rule, not a CPS import concept
- [ ] Add open items to `docs/features/import-export/<format>-outstanding.md`

---

## 9. Feature docs to update

- [ ] `docs/features/import-export/README.md` — implementation status row
- [ ] `docs/features/import-export/<format>/README.md` — adapter behaviour (link to tier 3 for wire tables)
- [ ] `docs/features/README.md` — index row if new top-level topic
- [ ] `docs/build/testing/mapping-tests.md` — adapter matrix row/column
- [ ] `docs/build/testing/fixtures.md` — bundle layout if new pattern
- [ ] Component sidecars if shared UI behaviour changes (see [component-sidecars.mdc](../../../.cursor/rules/component-sidecars.mdc))
- [ ] Optional: `AGENTS.md` repository layout table when a new top-level area ships

---

## 10. Cross-format

The library is the hub:

```text
FormatA → import → library + builds → export → FormatB
```

- [ ] Cross-format golden test: import FormatA fixture → export FormatB → assert expected fields
- [ ] Document expected loss at each boundary in reference docs
- [ ] Do not assume symmetric loss — document each direction

Cross-format tests are **planned**; OpenGD77 ↔ CHIRP was the first pair in the archive tool — CHIRP export is shipped; cross-format golden remains optional.

---

## 11. Manual verify

End-to-end smoke before PR:

1. `npm run dev`
2. **Library:** create or import test data (native YAML or future CPS import)
3. **Build:** create build for the format + profile; configure trait layout (zones, scan lists, …)
4. **Wire preview:** confirm expanded names and overrides on build sub-routes
5. **Export:** download per-file CSVs + ZIP; review warnings
6. **CSV preview modal:** on-screen tables match downloaded files
7. **Re-import** (when import ships): merge shows expected deltas
8. Hard refresh — IndexedDB persistence intact

---

## Worked example: OpenGD77 (export shipped)

| Step              | Location                                                     |
| ----------------- | ------------------------------------------------------------ |
| Reference hub     | `docs/reference/opengd77/README.md`                          |
| Radio profiles    | `docs/reference/opengd77/radios/`                            |
| Adapter behaviour | `docs/features/import-export/opengd77/README.md`             |
| Export adapter    | `formats/opengd77/adapter.ts`, `serialise.ts`, `listWire.ts` |
| Registry          | `registry.ts` — export only today                            |
| Trait profiles    | `opengd77-1701`, `opengd77-md9600` in `traits.ts`            |
| Fixtures / tests  | `formats/opengd77/serialise.test.ts`, `warnings.test.ts`     |
| Expansion         | Multi-mode **on** export; multi-TG **off** (native RGL)      |

---

## Worked example: DM32 (export shipped)

| Step              | Location                                                     |
| ----------------- | ------------------------------------------------------------ |
| Reference hub     | `docs/reference/dm32/README.md`                              |
| Adapter behaviour | `docs/features/import-export/dm32/README.md`                 |
| Export adapter    | `formats/dm32/adapter.ts`, `channelExpansion.ts`             |
| Zone scan derive  | `zoneDerivedScanLists/derive.ts`                             |
| Trait profile     | `dm32-baofeng-dm32uv`                                        |
| Fixtures / tests  | `src/test/dm32/`, `formats/dm32/serialise.test.ts`           |
| Expansion         | Multi-mode **off**; multi-TG **on**; zone-derived `Scan.csv` |

---

## Worked example: CHIRP (export shipped)

| Step          | Location                                                                          |
| ------------- | --------------------------------------------------------------------------------- |
| Feature hub   | `docs/features/import-export/chirp/README.md`                                     |
| Reference hub | `docs/reference/chirp/README.md`                                                  |
| Trait profile | `chirp-uv5r`, `chirp-rt95`, `chirp-uv21` — `FlatMemoryList`, `PerChannelScanFlag` |
| Adapter       | `formats/chirp/adapter.ts`, `serialise.ts`, `exportChannelWire.ts`                |
| Delivery      | `single-file-cps` — one memory CSV                                                |
| Assemble      | `flatMemoryLayout.ts` — ordered `channelIds` on build layout                      |
| UI            | `BuildMemoriesPage`, `ExportBuildCpsPanel` (Download CSV)                         |
| Tests         | `exportGolden.test.ts`, `serialise.test.ts`, `exportChannelWire.test.ts`          |
| Expansion     | Neither mode nor TG fan-out — flat analogue memories only                         |

---

## Worked example: Native YAML (project interchange)

Not a CPS format, but shows the **single-file project** adapter pattern:

| Step       | Location                                                     |
| ---------- | ------------------------------------------------------------ |
| Reference  | `docs/reference/native-yaml/README.md`                       |
| Adapter    | `formats/native-yaml/adapter.ts`, `parse.ts`, `serialise.ts` |
| Service    | `importProjectYaml.ts`, `exportProjectYaml.ts`               |
| Round-trip | `formats/native-yaml/roundtrip.test.ts`                      |

Use native YAML to move whole projects between browsers; use CPS adapters for vendor tooling.

---

## Master checklist (printable)

Use as a PR self-review list when shipping a new format slice.

### Docs

- [ ] Tier-3 `docs/reference/<format>/` complete for shipped files
- [ ] Tier-1 `docs/features/import-export/<format>/README.md` with implementation status
- [ ] Lossy fields documented
- [ ] Hub + mapping matrix updated

### Core

- [ ] `FormatId` + `formatCatalog` entry
- [ ] Adapter(s) registered; `adapterContract.test.ts` extended
- [ ] `TraitProfile` + radio `profiles.ts`
- [ ] Import maps wire → library (+ build layout); export uses `assemble` → serialise only
- [ ] Expansion axes chosen and implemented
- [ ] No wire stash; ASCII wire sanitisation at boundary
- [ ] Directional mapping tests with fixtures

### UI

- [ ] Catalog card import/export status correct
- [ ] New build + profile picker
- [ ] Trait build pages for organisation semantics
- [ ] Export panel + ZIP + warnings + CSV preview
- [ ] Wire preview matches export expansion
- [ ] Format-specific export settings defaults

### Manual

- [ ] Dev smoke per section 11
- [ ] `npm run format:check && npm run lint && npm run test && npm run build`

---

## Related

- [Import / export hub](README.md)
- [CPS export services](cps-services.md)
- [Mapping tests](../../build/testing/mapping-tests.md)
- [Fixtures](../../build/testing/fixtures.md)
- [Data model](../data-model/README.md)
- [Builds hub](../builds/README.md)
- [DESIGN.md](../../../DESIGN.md)
