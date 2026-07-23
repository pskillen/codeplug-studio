# ExportBuildSettingsSections

## Purpose

Grouped export preference controls on the build **Export** page.

- **Anytone** radios (catalog has an `anytone` compatible egress) use entity-based sections (`ExportAnytoneSettingsSections`): Channels, Zones, Scan lists, Talk groups, Contacts, RX group lists.
- Other radios use inclusion, channel expansion (m×n-capable targets), naming, and scanning groupings.

## Props

| Prop                      | Type                          | Description                                                                      |
| ------------------------- | ----------------------------- | -------------------------------------------------------------------------------- |
| `build`                   | `FormatBuild` / `RadioBuild`  | Active radio build                                                               |
| `formatId`                | `string`                      | Active egress format — pathway copy only (e.g. naming card “radio write” wording) |
| `saving`                  | `boolean`                     | Disables controls while persisting                                               |
| `settingsError`           | `string \| null`              | Inclusion save error message                                                     |
| `profileNameLimit`        | `number?`                     | Active pathway wire name cap for naming fields                                   |
| `resolvedSettings`        | `ResolvedBuildExportSettings` | Merged radio defaults + stored `exportSettings`                                  |
| `formatDefaults`          | `FormatExportDefaults`        | Catalog **default egress** format defaults for scan inclusion hint               |
| `defaultScanValue`        | `DefaultScanInclusion`        | Effective default scan behaviour                                                 |
| `onExportSettingsPatch`   | `(patch) => void`             | Persists `build.exportSettings` partial updates                                  |
| `onExportInclusionChange` | `(field, checked) => void`    | Persists unlinked entity inclusion flags                                         |

## Behaviour

- Projection visibility (scan inclusion, m×n, Anytone tree, zone-derived scan, contact name mode) is gated by **`build.radioTargetId`** catalog traits / compatible formats — not the active egress `profileId`. Switching pathways must not show or hide these controls.
- **Channel expansion** appears when the radio target includes `mxnChannelExpansion`. Labels use [DESIGN.md — Glossary](../../../DESIGN.md#glossary) terminology (`m×n channel expansion`).
- **Scratch channels** toggle is enabled only when m×n expansion is on; turning expansion off clears scratch.
- Zone-derived scan list toggle is shown when the radio catalog lists a `dm32` or `anytone` compatible egress.

## Related

- [docs/features/import-export/anytone/export-projections.md](../../../docs/features/import-export/anytone/export-projections.md)
- [wire-preview.md](../../../docs/features/builds/wire-preview.md)
- [#658](https://github.com/pskillen/codeplug-studio/issues/658) — radio-target trait gating
