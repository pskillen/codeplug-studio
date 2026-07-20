# BuildEntityExportSettingsCard

## Purpose

Mirrors entity-scoped Export page settings onto Build → entity wire routes (Channels, Talk groups, Contacts, RX group lists), with copy that explains why these settings appear again after library curation.

## Props

| Prop                               | Type                          | Description                         |
| ---------------------------------- | ----------------------------- | ----------------------------------- |
| `build`                            | `FormatBuild`                 | Current build                       |
| `entityKind`                       | `WirePreviewEntityKind`       | Which settings group to show        |
| `saving`                           | `boolean` (opt.)              | Disable controls while persisting   |
| `exportSettings`                   | `ResolvedBuildExportSettings` | Resolved name/abbreviation settings |
| `showExportNameMode`               | `boolean` (opt.)              | Channel wire name mode              |
| `showDigitalContactExportNameMode` | `boolean` (opt.)              | Contacts name mode                  |
| `showLibraryAbbreviations`         | `boolean` (opt.)              | Abbreviations switch                |
| `onExportSettingsPatch`            | `(patch) => void`             | Persist export settings             |
| `onExportInclusionChange`          | `(field, checked) => void`    | Persist unlinked inclusion flags    |
| `actions`                          | `ReactNode` (opt.)            | e.g. `ChannelsBulkEditAction`       |

## Related

- [wire-preview.md](../../../docs/features/builds/wire-preview.md)
- [ExportBuildSettingsSections.md](./ExportBuildSettingsSections.md)
