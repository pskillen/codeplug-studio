# ExportBuildSettingsSections

## Purpose

Grouped export preference controls on the build **Export** page.

- **Anytone** builds use entity-based sections (`ExportAnytoneSettingsSections`): Channels, Zones, Scan lists, Talk groups, Contacts, RX group lists.
- Other formats use inclusion, channel expansion (m×n-capable profiles), naming, and scanning groupings.

## Props

| Prop                      | Type                          | Description                                      |
| ------------------------- | ----------------------------- | ------------------------------------------------ |
| `build`                   | `FormatBuild`                 | Active format build                              |
| `saving`                  | `boolean`                     | Disables controls while persisting               |
| `settingsError`           | `string \| null`              | Inclusion save error message                     |
| `profileNameLimit`        | `number?`                     | Profile wire name cap for naming fields          |
| `resolvedSettings`        | `ResolvedBuildExportSettings` | Merged format defaults + stored `exportSettings` |
| `formatDefaults`          | `FormatExportDefaults`        | Adapter defaults for scan inclusion hint         |
| `defaultScanValue`        | `DefaultScanInclusion`        | Effective default scan behaviour                 |
| `onExportSettingsPatch`   | `(patch) => void`             | Persists `build.exportSettings` partial updates  |
| `onExportInclusionChange` | `(field, checked) => void`    | Persists unlinked entity inclusion flags         |

## Behaviour

- **Anytone** builds render entity-based `FieldCard` sections (Channels, Zones, Scan lists, Talk groups, Contacts, RX group lists) with sub-headings for logical control groups inside Channels.
- **Channel expansion** appears when the trait profile includes `mxnChannelExpansion` (Anytone AT-D890UV, DM32). Labels use [DESIGN.md — Glossary](../../../DESIGN.md#glossary) terminology (`m×n channel expansion`).
- **Scratch channels** toggle is enabled only when m×n expansion is on; turning expansion off clears scratch.
- Zone-derived scan list toggle is shown for DM32 and Anytone builds.

## Related

- [docs/features/import-export/anytone/export-projections.md](../../../docs/features/import-export/anytone/export-projections.md)
- [wire-preview.md](../../../docs/features/builds/wire-preview.md)
