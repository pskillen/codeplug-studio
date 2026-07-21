# Dm32PreferNeonPlugAlert

Strong export-page warning that Baofeng DM-32 CPS CSV is deprecated for radio write; steer operators to NeonPlug.

## Purpose

Stock Baofeng DM-32 CPS CSV import is unreliable. This alert tells operators to prefer a NeonPlug build and `.neonplug` merge-on-export path, without blocking DM32 CSV download.

## Props

None — parent mounts only when `build.formatId === 'dm32'`.

## Usage

```tsx
{
  build.formatId === 'dm32' ? <Dm32PreferNeonPlugAlert /> : null;
}
```

## Behaviour

- Always renders when mounted (no file-list gate).
- Links to `/builds/new` and [neonplug.app](https://neonplug.app).
- Orange Mantine `Alert` — stronger than the yellow APRS tip.

## Related

- [`ExportBuildCpsPanel.tsx`](ExportBuildCpsPanel.tsx)
- [`Dm32AprsSetupAlert.tsx`](Dm32AprsSetupAlert.tsx) — separate APRS CPS checklist
- [DM32 feature hub](../../../../docs/features/import-export/dm32/README.md)
- [NeonPlug feature hub](../../../../docs/features/import-export/neonplug/README.md)
- Tracking: [#556](https://github.com/pskillen/codeplug-studio/issues/556)
