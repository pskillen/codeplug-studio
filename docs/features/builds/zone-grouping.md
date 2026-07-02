## Purpose

Build-scoped zone member ordering for profiles with the **zone grouping** trait. Library `Zone` rows remain the source of truth for which channels belong to a zone; the build `ZoneGroupingLayout` controls **export order** and which included channels appear in each zone on the wire.

**Tracking:** [#87](https://github.com/pskillen/codeplug-studio/issues/87)

**Code:** `src/core/domain/zoneGroupingLayout.ts`, `src/app/components/builds/BuildZoneLayoutEditor.tsx`, `/builds/:id/zones`

## Behaviour

1. Open **Zones** on a build whose profile includes `ZoneGrouping` (OpenGD77 1701 / MD9600).
2. On first visit, if `layout.sections` has no `zoneGrouping` section, the app **seeds** one from library zone membership and persists it on the build.
3. Pick a zone, then use the dual-list **ZoneMemberPicker** pattern to add/remove/reorder channels.
4. Only channels **included** in the build (not `channelOverrides.excluded`) appear in the picker pool.
5. Zone **wire names** are edited in the `WirePreviewTable` below the layout editor (`zoneOverrides`).

`assemble` prefers `layout.sections` zone grouping over raw library membership when sections exist. Empty zones with no override are omitted from export.

## Model

```typescript
interface ZoneGroupingLayout {
  kind: 'zoneGrouping';
  zones: Array<{ id: string; name: string; channelIds: string[] }>;
}
```

`name` mirrors the library zone at seed time; wire export uses `zoneOverrides.wireName` or the library zone name.

## Related

- [wire-preview.md](wire-preview.md) — override semantics and shared table
- [data-model](../data-model/README.md) — trait layout vs library zones
- [cps-services.md](../import-export/cps-services.md) — `assemble` zone projection
