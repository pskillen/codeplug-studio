# ExportNameSettingsFields

## Purpose

Naming section content for [`ExportBuildSettingsSections`](./ExportBuildSettingsSections.md) —
shared by every export/write target. Renders, in order:

1. **Name style** — `ExportNameModeSelect` (`nameModeOverride`), plus
   `DigitalContactExportNameModeSelect` when the target catalog has an `anytone` or
   `opengd77` compatible egress
2. **Shorten and length** — `shortenNames` switch + `maxNameLength` number field, shown
   as fixed context against `profileNameLimit` ("This radio allows N characters") rather
   than a fake style control
3. **Use abbreviations from library** — [`LibraryAbbreviationsFields`](./LibraryAbbreviationsFields.md)

## Props

| Prop               | Type              | Description                                     |
| ------------------ | ----------------- | ----------------------------------------------- |
| `build`            | `FormatBuild`     | Active build                                    |
| `onPatch`          | `(patch) => void` | Persists `build.exportSettings` partial updates |
| `saving`           | `boolean` (opt.)  | Disables controls while persisting              |
| `profileNameLimit` | `number?`         | Active pathway wire name cap                    |

## Behaviour

- `maxNameLength` uses `useDebouncedOptionalNumberField` (debounced local draft, commits
  after 300 ms or on blur) — the same pattern the AT-D890UV scan-timing fields use, not a
  per-keystroke save. Every target gets this behaviour now that Naming is one component
  instead of an Anytone-only debounced copy and a non-Anytone per-keystroke copy.

## Related

- [ExportBuildSettingsSections.md](./ExportBuildSettingsSections.md)
- [LibraryAbbreviationsFields.md](./LibraryAbbreviationsFields.md)
