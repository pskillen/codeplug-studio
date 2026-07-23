## Purpose

Zone override modal **Members** tab — build-scoped member **export order** for one zone (`ZoneGroupingZoneEntry.channelIds`). Does not mutate library zone membership.

**Tracking:** [#472](https://github.com/pskillen/codeplug-studio/issues/472) · projection nest ([#560](https://github.com/pskillen/codeplug-studio/issues/560))

## Props

| Prop                   | Type                                          | Description                                            |
| ---------------------- | --------------------------------------------- | ------------------------------------------------------ |
| `zone` / `zones`       | `Zone`                                        | Library zone + full zone list for effective membership |
| `entry`                | `ZoneGroupingZoneEntry` (optional)            | Build layout hint for member order                     |
| `channelById`          | `Map<string, Channel>`                        | Labels + Sort…                                         |
| `expansionByChannelId` | `Map<string, ExpandedMxNChannelRow[]>` (opt.) | MxN expansion — nests export wire names under parents  |
| `saving`               | `boolean`                                     | Disables reorder controls                              |
| `onSetChannelIds`      | `(channelIds: string[]) => void`              | Persists layout member order                           |

## Behaviour

- Reorder (drag, arrows, Sort…) operates on **parent library channel ids** only.
- When `expansionByChannelId` has multiple rows for a channel, shows shaded parent chrome with chevron collapse and **N projections** badge; children list export wire names (read-only).
- Single expanded wire shows a dim **Export wire:** subline when expansion data is present.

## Related

- [wire-preview.md](../../../../docs/features/builds/wire-preview.md)
- [ZoneScanExportControls.md](../../ZoneScanExportControls.md) — Scan tab nest + inclusion toggles
- `BuildZonesWirePage` wires `useZoneScanExportLayout().expansionByChannelId`
