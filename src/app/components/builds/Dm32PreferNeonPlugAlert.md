# Dm32PreferNeonPlugAlert

Strong export-page warning that Baofeng DM-32 CPS CSV is a poor path for radio write; steer operators to NeonPlug (and Web Serial when that egress exists).

## Purpose

Baofeng DM-32 CPS often imports CSV incompletely. This alert prefers a NeonPlug `.neonplug` write path (or in-browser Web Serial when available), without blocking DM32 CSV download.

Copy follows the [help writing styleguide](../../../../docs/reference/writing-styleguide/help-writing-styleguide.md): lead with the risk, short sentences, British English, no developer jargon.

## Props

None — parent mounts only when the **active Export egress** is native DM32 CPS (`formatId === 'dm32'`). Do **not** mount on New Radio / radio-target create.

## Usage

```tsx
{
  formatId === 'dm32' ? <Dm32PreferNeonPlugAlert /> : null;
}
```

`ExportBuildCpsPanel` mounts this when the selected egress is DM32 CSV. It is **not** shown for NeonPlug or Web Serial egresses, and not on [`NewBuildPage`](../../routes/builds/NewBuildPage.tsx).

## Behaviour

- Always renders when mounted (no file-list gate).
- Links to [neonplug.app](https://neonplug.app).
- Orange Mantine `Alert` — stronger than the yellow APRS tip.

## Related

- [`ExportBuildCpsPanel.tsx`](ExportBuildCpsPanel.tsx)
- [`preferNeonPlugPathwayBadges.tsx`](preferNeonPlugPathwayBadges.tsx) — pathway pills on format/profile pickers
- [`Dm32AprsSetupAlert.tsx`](Dm32AprsSetupAlert.tsx) — separate APRS CPS checklist
- [DM32 feature hub](../../../../docs/features/import-export/dm32/README.md)
- [NeonPlug feature hub](../../../../docs/features/import-export/neonplug/README.md)
- Tracking: [#556](https://github.com/pskillen/codeplug-studio/issues/556) · warning placement [#638](https://github.com/pskillen/codeplug-studio/issues/638)
