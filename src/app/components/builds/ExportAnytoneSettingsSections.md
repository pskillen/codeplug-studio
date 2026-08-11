# ExportAnytoneSettingsSections

## Purpose

Entity-grouped export preference controls for Anytone radio targets on the build **Export → settings** page: Channels, Zones, Scan lists, Talk groups, Contacts, and RX group lists.

## Props

Subset of [`ExportBuildSettingsSections`](./ExportBuildSettingsSections.md) — `build`, `saving`, `settingsError`, `profileNameLimit`, `resolvedSettings`, `onExportSettingsPatch`, `onExportInclusionChange`.

## Behaviour

- **AT-D890UV** (`radioTargetId === 'anytone-at-d890uv`) shows four **Scan list timing** fields under the Scan lists card (Look Back A/B, Dropout Delay, Dwell). Values use debounced local draft state (same model as library list search) and persist to `build.exportSettings` after **300 ms** or on **blur** when still pending. They apply to every library and zone-derived `ScanList.CSV` row and Web Serial scan-list record. Empty fields export the 3.0 s default.
- **Target name length** uses the same debounced number field pattern — not per-keystroke save.
- Other Anytone targets do not show scan-list timing controls (interim D890-only slice — [#1069](https://github.com/pskillen/codeplug-studio/issues/1069)).
- m×n expansion and scratch toggles appear when the radio target includes `mxnChannelExpansion`.

## Related

- [ExportBuildSettingsSections.md](./ExportBuildSettingsSections.md)
- [docs/features/import-export/anytone/export-projections.md](../../../docs/features/import-export/anytone/export-projections.md)
- [#1069](https://github.com/pskillen/codeplug-studio/issues/1069) — build-level D890 scan timing
