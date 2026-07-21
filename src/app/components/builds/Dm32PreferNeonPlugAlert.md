# Dm32PreferNeonPlugAlert

Strong export-page warning that Baofeng DM-32 CPS CSV is a poor path for radio write; steer operators to NeonPlug.

## Purpose

Baofeng DM-32 CPS often imports CSV incompletely. This alert prefers a NeonPlug build and `.neonplug` write path, without blocking DM32 CSV download.

Copy follows the [help writing styleguide](../../../../docs/reference/writing-styleguide/help-writing-styleguide.md): lead with the risk, short sentences, British English, no developer jargon.

## Props

None — parent mounts only when `build.formatId === 'dm32'`.

## Usage

```tsx
{
  build.formatId === 'dm32' ? <Dm32PreferNeonPlugAlert /> : null;
}
```

`ExportBuildCpsPanel` mounts this **twice** on long DM32 export pages: once at the top of the panel (above the fold) and again just above the download buttons.

## Behaviour

- Always renders when mounted (no file-list gate).
- Links to `/builds/new` and [neonplug.app](https://neonplug.app).
- Orange Mantine `Alert` — stronger than the yellow APRS tip.

## Related

- [`ExportBuildCpsPanel.tsx`](ExportBuildCpsPanel.tsx)
- [`preferNeonPlugPathwayBadges.tsx`](preferNeonPlugPathwayBadges.tsx) — New build card pills
- [`Dm32AprsSetupAlert.tsx`](Dm32AprsSetupAlert.tsx) — separate APRS CPS checklist
- [DM32 feature hub](../../../../docs/features/import-export/dm32/README.md)
- [NeonPlug feature hub](../../../../docs/features/import-export/neonplug/README.md)
- Tracking: [#556](https://github.com/pskillen/codeplug-studio/issues/556)
