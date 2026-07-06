# Zone-pivoted channels and zones UI

Deep dive for the unified **Channels & zones** management screen ([#180](https://github.com/pskillen/codeplug-studio/issues/180)).

**Tracking:** Epic [#179](https://github.com/pskillen/codeplug-studio/issues/179)

## Purpose

Operators organise library channels through **zone pivots** instead of separate channel and zone list routes. One screen covers:

- All channels
- Channels not in any zone
- Per-zone membership (ordered for export)

Membership changes use **`AddChannelsToZoneModal`**; the legacy two-list `ZoneMemberPicker` is no longer on the zone editor.

## Route and URL

| Path                                      | Behaviour                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------ |
| `/library/zones?pivot=all`                | Default — all channels (also `/library` and `/library/channels` redirect here) |
| `/library/zones?pivot=orphans`            | Channels in no zone (effective membership)                                     |
| `/library/zones?pivot=zone&zoneId=<uuid>` | Direct channel members of one zone                                             |
| `/library/zones/new`                      | Create-only zone form (optional members from selection)                        |
| `/library/zones/:id` (existing)           | Redirects to per-zone pivot                                                    |

Query helpers: `src/app/routes/library/zonePivotQuery.ts`.

## Code anchors

| Symbol                    | Path                                                    | Role                                    |
| ------------------------- | ------------------------------------------------------- | --------------------------------------- |
| `ChannelsAndZonesPage`    | `src/app/routes/library/ChannelsAndZonesPage.tsx`       | Shell: pivot panel + table + map        |
| `ZonePivotPanel`          | `src/app/components/library/ZonePivotPanel.tsx`         | Sidebar / mobile pivot selector         |
| `LibraryChannelTable`     | `src/app/components/library/LibraryChannelTable.tsx`    | Shared channel `DataTable`              |
| `AddChannelsToZoneModal`  | `src/app/components/library/AddChannelsToZoneModal.tsx` | Add channels / nested zones             |
| `ZoneInlineSettings`      | `src/app/components/library/ZoneInlineSettings.tsx`     | Name, comment, `omitFromExport`, delete |
| `useZonePivotChannelRows` | `src/app/hooks/useZonePivotChannelRows.ts`              | Row source per pivot                    |
| `useZonePivotMap`         | `src/app/hooks/useZonePivotMap.ts`                      | Contextual map props per pivot          |
| `zoneMembership`          | `src/core/domain/zoneMembership.ts`                     | Unzoned helpers; add/remove/reorder     |

## Workflows

### All channels

- Full channel table with section-nav filters (band, mode, duplex, distance).
- **New channel**, **New zone from selected**, **New zone** (empty).
- Contextual map: filtered channel set when distance filter active; all zone hulls.

### Not in a zone

- Table lists channels with no effective zone membership (`channelInAnyZoneMembership`).
- **Add to zone…** opens modal with target-zone picker.

### Per-zone pivot

- **ZoneInlineSettings** — inline metadata; blur-to-save name/comment; toggle `omitFromExport`.
- Table shows **direct channel members** in export order; move up/down; remove single/bulk.
- **Add channels…** modal.
- Map uses zone-emphasis mode (dim non-members; fit bounds to effective members).

### Integrated flows (sibling tickets)

| Ticket                                                         | Entry on unified screen                |
| -------------------------------------------------------------- | -------------------------------------- |
| [#154](https://github.com/pskillen/codeplug-studio/issues/154) | **New zone from selected**             |
| [#181](https://github.com/pskillen/codeplug-studio/issues/181) | Pivot panel **New zone from location** |
| [#157](https://github.com/pskillen/codeplug-studio/issues/157) | Nested zones tab in add modal          |
| [#172](https://github.com/pskillen/codeplug-studio/issues/172) | Quick links in add modal + section nav |

## Map placement

| View           | Map                                                    |
| -------------- | ------------------------------------------------------ |
| Unified screen | Contextual per pivot — see [map hub](../map/README.md) |
| Summary        | Full-library overview map                              |

## Manual verify

1. Open **Channels & zones** — pivot **All channels**; filters in section nav narrow the table.
2. Select rows → **New zone from selected** → save → lands on new zone pivot with members.
3. Per-zone pivot → **Add channels…** → add/remove; reorder; reload — order persists.
4. **Not in a zone** → **Add to zone…** → pick zone → add channels.
5. `/library/channels` redirects to `?pivot=all`; Summary shows full library map.
6. `/library/zones/<existing-id>` redirects to zone pivot.

## Related

- [library README](README.md) · [nested-zones.md](nested-zones.md)
- [zone-member-picker.md](zone-member-picker.md) — legacy picker (deprecated on zone editor)
- `AddChannelsToZoneModal.md` sidecar
