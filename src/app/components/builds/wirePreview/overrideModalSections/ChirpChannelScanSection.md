# ChirpChannelScanSection

## Purpose

Per-channel scan inclusion control in the flat-memory channel wire-preview modal (CHIRP / NeonPlug UV5R-Mini). Persists as a **build** `channelOverrides.scanInclusion` override — not library `Channel.scanInclusion`.

## Props

| Prop           | Type                                     | Description                                                       |
| -------------- | ---------------------------------------- | ----------------------------------------------------------------- |
| `value`        | `ScanInclusion`                          | Effective value for this build (`override ?? library`)            |
| `saving`       | `boolean`                                | Disables the segment while a save is in flight                    |
| `onScanChange` | `(scanInclusion: ScanInclusion) => void` | Persist via `BuildService.withScanInclusionOverride` + `putBuild` |

## Usage

```tsx
<ChirpChannelScanSection
  value={overrideScanInclusion(build.channelOverrides, channel.id) ?? channel.scanInclusion}
  saving={saving}
  onScanChange={(scanInclusion) => void updateChannelScan(channel.id, scanInclusion)}
/>
```

## Behaviour

- Segment options: Default / Skip scan / Always scan.
- Parent must write build overrides — never `putChannel` for this control.
- Library channel editor remains the place to edit the shared `scanInclusion`.

## Related

- [Wire preview](../../../../../docs/features/builds/wire-preview.md)
- [Scan inclusion](../../../../../docs/reference/scan-inclusion.md)
- [#589](https://github.com/pskillen/codeplug-studio/issues/589)
