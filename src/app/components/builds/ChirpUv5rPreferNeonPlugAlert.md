# ChirpUv5rPreferNeonPlugAlert

Soft export-page hint that CHIRP UV-5R Mini support is still being tested; steer operators to NeonPlug.

## Purpose

CHIRP CSV for UV-5R Mini is not fully proven. This alert prefers the NeonPlug UV-5R Mini pathway without blocking CHIRP CSV download.

Copy follows the [help writing styleguide](../../../../docs/reference/writing-styleguide/help-writing-styleguide.md).

## Props

None — parent mounts only when `build.formatId === 'chirp'` and export profile is `chirp-uv5r`.

## Usage

```tsx
{
  build.formatId === 'chirp' && exportProfileId === 'chirp-uv5r' ? (
    <ChirpUv5rPreferNeonPlugAlert />
  ) : null;
}
```

`ExportBuildCpsPanel` mounts this **twice**: once at the top of the single-file export stack and again just above **Download CSV**.

## Behaviour

- Always renders when mounted.
- Gate on **export-time** profile (`exportProfileId`), not only `build.profileId`, because CHIRP allows profile override on the export page.
- Links to `/builds/new` and [neonplug.app](https://neonplug.app).
- Yellow Mantine `Alert` — softer than the orange DM32 alert.

## Related

- [`ExportBuildCpsPanel.tsx`](ExportBuildCpsPanel.tsx)
- [`preferNeonPlugPathwayBadges.tsx`](preferNeonPlugPathwayBadges.tsx) — New build card pills
- [`Dm32PreferNeonPlugAlert.tsx`](Dm32PreferNeonPlugAlert.tsx) — stronger sibling for DM32 CPS
- [CHIRP feature hub](../../../../docs/features/import-export/chirp/README.md)
- [NeonPlug feature hub](../../../../docs/features/import-export/neonplug/README.md)
- Tracking: [#556](https://github.com/pskillen/codeplug-studio/issues/556)
