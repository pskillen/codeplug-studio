# ZoneBehaviourExportOverrides

Build Export panel control for `BuildExportSettings.defaultIncludeInZoneDerivedScanList`.

## Purpose

Optional build-wide override of library `zoneDefaults.includeInZoneDerivedScanList` for zone-derived scan list membership. Orthogonal to channel `defaultScanInclusion`.

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `exportSettings` | `BuildExportSettings \| undefined` | Current build settings |
| `disabled` | `boolean` | Disable controls |
| `onPatch` | `(patch) => void` | Merge into export settings |

## Related

- [`ChannelBehaviourExportOverrides`](./ChannelBehaviourExportOverrides.md)
- [`ZoneScanExportControls`](./ZoneScanExportControls.md)
