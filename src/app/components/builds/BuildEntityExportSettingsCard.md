# BuildEntityExportSettingsCard

## Purpose

Mirrors a subset of the [`ExportBuildSettingsSections`](./ExportBuildSettingsSections.md)
"What gets exported" / "Naming" controls onto Build → entity wire routes (Channels, Talk
groups, Contacts, RX group lists) as one entity-scoped card, with copy that explains why
these settings appear again after library curation. No copy or control here is unique to
this card — everything is a subset of the shared Export settings tree, with a link back
to it.

## Props

| Prop                               | Type                          | Description                                                                                                    |
| ---------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `build`                            | `FormatBuild`                 | Current build                                                                                                  |
| `entityKind`                       | `WirePreviewEntityKind`       | Which settings group to show                                                                                   |
| `saving`                           | `boolean` (opt.)              | Disable controls while persisting                                                                              |
| `exportSettings`                   | `ResolvedBuildExportSettings` | Resolved name/abbreviation settings                                                                            |
| `showExportNameMode`               | `boolean` (opt.)              | Channel wire name mode                                                                                         |
| `showDigitalContactExportNameMode` | `boolean` (opt.)              | Contacts name mode                                                                                             |
| `showLibraryAbbreviations`         | `boolean` (opt.)              | [`LibraryAbbreviationsFields`](./LibraryAbbreviationsFields.md) scoped to `entityKind` (channel or talk group) |
| `onExportSettingsPatch`            | `(patch) => void`             | Persist export settings                                                                                        |
| `onExportInclusionChange`          | `(field, checked) => void`    | Persist unlinked inclusion flags                                                                               |
| `actions`                          | `ReactNode` (opt.)            | e.g. `ChannelsBulkEditAction`                                                                                  |

## Related

- [wire-preview.md](../../../docs/features/builds/wire-preview.md)
- [ExportBuildSettingsSections.md](./ExportBuildSettingsSections.md)
- [LibraryAbbreviationsFields.md](./LibraryAbbreviationsFields.md)
