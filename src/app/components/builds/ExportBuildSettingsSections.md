# ExportBuildSettingsSections

## Purpose

One capability-gated section tree for export/write preference controls on the build
**Export** page — every target (Anytone included) shares the same section headings and
order. Individual controls within a section gate on `build.radioTargetId` catalog traits
/ compatible formats; the tree itself no longer forks.

## Section order

1. **Channel eligibility** — RF range filter (`FrequencyRangeEligibilityFields`)
2. **What gets exported** — per-entity-kind "not linked" inclusion switches; hidden
   entirely for flat-memory targets (no zone/channel linkage concept)
3. **Naming** — name style, contact naming (where shown), shorten + length, library
   abbreviations (`ExportNameSettingsFields`)
4. **Channel expansion** — m×n expansion + scratch channels; shown when the radio target
   has the `mxnChannelExpansion` trait
5. **Organisation** — default scan behaviour, or (dedicated-scan-list radios) guidance
   that scan lists use library membership + per-channel assignment instead of an export
   default, plus zone-derived scan list creation and AT-D890UV scan timing where
   applicable
6. **Channel behaviour** — build-level overrides for library behavioural defaults,
   always shown (fields inside gate by mode support)
7. **Digital ID directory** — `ExportDirectoryProjectionFields`; self-gates and renders
   nothing when the target has neither dual-bank nor single-bank directory trait

These section names are the vocabulary phase 8's Resolution view attributes values to
("build export settings → Naming", …) — rename here and there together.

## Props

| Prop                      | Type                          | Description                                                                       |
| ------------------------- | ----------------------------- | --------------------------------------------------------------------------------- |
| `build`                   | `FormatBuild` / `RadioBuild`  | Active radio build                                                                |
| `formatId`                | `string`                      | Active egress format — pathway copy only (e.g. naming card “radio write” wording) |
| `profileId`               | `string`                      | Active egress profile — directory projection trait gates                          |
| `saving`                  | `boolean`                     | Disables controls while persisting                                                |
| `settingsError`           | `string \| null`              | Inclusion save error message                                                      |
| `profileNameLimit`        | `number?`                     | Active pathway wire name cap for naming fields                                    |
| `resolvedSettings`        | `ResolvedBuildExportSettings` | Merged radio defaults + stored `exportSettings`                                   |
| `formatDefaults`          | `FormatExportDefaults`        | Catalog **default egress** format defaults for scan inclusion hint                |
| `defaultScanValue`        | `DefaultScanInclusion`        | Effective default scan behaviour                                                  |
| `onExportSettingsPatch`   | `(patch) => void`             | Persists `build.exportSettings` partial updates                                   |
| `onExportInclusionChange` | `(field, checked) => void`    | Persists unlinked entity inclusion flags                                          |

## Behaviour

- Projection visibility (scan inclusion, m×n, zone-derived scan, contact name mode) is
  gated by **`build.radioTargetId`** catalog traits / compatible formats — not the
  active egress `profileId`. Switching pathways must not show or hide these controls.
- **Channel expansion** appears when the radio target includes `mxnChannelExpansion`.
  Labels use [DESIGN.md — Glossary](../../../DESIGN.md#glossary) terminology
  (`m×n channel expansion`).
- **Scratch channels** toggle is enabled only when m×n expansion is on; turning
  expansion off clears scratch.
- **Create scan lists from zones** (zone-derived scan lists) is shown when the radio
  catalog lists a `dm32` or `anytone` compatible egress. No CPS filename in the label —
  it applies the same on radio-io Web Serial write, which has no CPS file at all.
- **AT-D890UV** scan-list timing fields render inline in the Organisation section
  (`AtD890ScanListTimingFields`) when `radioTargetId === 'anytone-at-d890uv'`.
- Dual-bank CPS (`SeparateDigitalIdList`) or Anytone single-bank uses
  `ExportDirectoryProjectionFields` — **Include library digital contacts** / **Include
  digital ID directory**, or the single-bank projection mode select. The component
  returns `null` (no empty card) when neither trait applies.
- **Naming** delegates to [`ExportNameSettingsFields`](./ExportNameSettingsFields.md) —
  see that sidecar for the abbreviations / shorten-length grouping.

## Related

- [ExportNameSettingsFields.md](./ExportNameSettingsFields.md)
- [LibraryAbbreviationsFields.md](./LibraryAbbreviationsFields.md)
- [BuildEntityExportSettingsCard.md](./BuildEntityExportSettingsCard.md)
- [docs/features/import-export/anytone/export-projections.md](../../../docs/features/import-export/anytone/export-projections.md)
- [wire-preview.md](../../../docs/features/builds/wire-preview.md)
- [#658](https://github.com/pskillen/codeplug-studio/issues/658) — radio-target trait gating
- [#1218](https://github.com/pskillen/codeplug-studio/issues/1218) — one export-settings tree for every target
