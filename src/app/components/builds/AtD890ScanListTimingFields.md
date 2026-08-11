# AtD890ScanListTimingFields

## Purpose

D890-only scan-list timing controls for the Export settings Scan lists card. Uses debounced local draft state (same commit model as library list search via [`useDebouncedOptionalNumberField`](../../hooks/useDebouncedOptionalNumberField.ts)) and persists on blur when edits are still pending.

## Props

| Prop             | Type                                            | Description                                         |
| ---------------- | ----------------------------------------------- | --------------------------------------------------- |
| `exportSettings` | `BuildExportSettings` (optional)                | Current persisted build export prefs                |
| `onPatch`        | `(patch: Partial<BuildExportSettings>) => void` | Called after debounce or on blur when value changed |

## Related

- [ExportAnytoneSettingsSections.md](./ExportAnytoneSettingsSections.md)
