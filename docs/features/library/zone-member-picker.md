# Zone member picker

Deep dive for **`ZoneMemberPicker`** — the two-list membership editor used on the zone form.

**Tracking:** [#25](https://github.com/pskillen/codeplug-studio/issues/25), nested zones [#157](https://github.com/pskillen/codeplug-studio/issues/157)

## Purpose

Replaces checkbox-only zone membership with available ↔ in-zone lists, per-side search, add/remove, and move up/down. Saved `Zone.members` is an ordered list of `ZoneMemberEntry` values (`kind: 'channel'` or `kind: 'zone'`); **picker order is export order** for direct members; nested zones expand at export (see [nested-zones.md](nested-zones.md)).

The zone editor also embeds **`CodeplugMap`** below the picker so hull geometry updates from the **effective** (flattened) channel set.

## Code anchors

| Symbol                  | Path                                                  | Role                      |
| ----------------------- | ----------------------------------------------------- | ------------------------- |
| `ZoneMemberPicker`      | `src/app/components/library/ZoneMemberPicker.tsx`     | Two-list UI               |
| `zoneMemberPickerUtils` | `src/app/components/library/zoneMemberPickerUtils.ts` | Map filter helpers        |
| `ZoneEditor`            | `src/app/routes/library/ZoneEditor.tsx`               | Picker + live map preview |

Sidecar: `src/app/components/library/ZoneMemberPicker.md`.

## Behaviour

| Control                        | Effect                                                                                                                                                                             |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Available search               | Filters **channels** and **zones** not yet in the zone by name (channels also match callsign)                                                                                      |
| In-zone search                 | Filters current members (channel name/callsign or zone name)                                                                                                                       |
| Hide filtered entries from map | One checkbox below each list; when checked and a filter is active, matching entries are omitted from map markers; in-zone filter also trims the zone hull preview for channel rows |
| Add / Remove                   | Moves selected rows between lists                                                                                                                                                  |
| Move up / down                 | Reorders selected in-zone members as a block                                                                                                                                       |
| Checkbox selection             | Multi-select on each side                                                                                                                                                          |

**Available zones** excludes the zone being edited, its descendant zones (would create a cycle), and zones already in the member list.

Channel rows use **callsign — name** when a callsign is set (`channelDisplayLabel`). Zone rows show **Zone: {name}** with a link to the zone editor.

## Map preview

`ZoneEditor` builds a `previewZone` from unsaved form state and passes it to `CodeplugMap`. Hull shape uses `resolveEffectiveZoneChannelIds` — nested zone members contribute their descendant channels.

## Manual verify

1. Zone editor → add channels and a child zone, reorder with move up/down — map hull updates.
2. Save, reopen editor — order and member kinds match.
3. Add a zone that would cycle — save shows validation error.
4. Channels list → select rows → **New zone from selected** — zone editor opens with channels pre-filled ([#154](https://github.com/pskillen/codeplug-studio/issues/154)).

## Related

- [library/README.md](README.md#zone-member-picker-25-157) · [nested-zones.md](nested-zones.md) · [map/zones.md](../map/zones.md)
- [library-routes-progress.md](../app-shell/library-routes-progress.md)
