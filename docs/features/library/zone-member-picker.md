# Zone member picker

Deep dive for **`ZoneMemberPicker`** — the two-list channel membership editor used on the zone form.

**Tracking:** [#25](https://github.com/pskillen/codeplug-studio/issues/25)

## Purpose

Replaces checkbox-only zone membership with available ↔ in-zone lists, per-side search, add/remove, and move up/down. Saved `Zone.members` is an ordered `EntityRef[]` (`{ kind: 'channel', id }`); **picker order is export order**.

The zone editor also embeds **`CodeplugMap`** below the picker so hull geometry updates as membership changes.

## Code anchors

| Symbol             | Path                                              | Role                      |
| ------------------ | ------------------------------------------------- | ------------------------- |
| `ZoneMemberPicker` | `src/app/components/library/ZoneMemberPicker.tsx` | Two-list UI               |
| `ZoneEditor`       | `src/app/routes/library/ZoneEditor.tsx`           | Picker + live map preview |

## Behaviour

| Control                        | Effect                                                                                                                                                                            |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Available search               | Filters channels not yet in the zone by **name or callsign** (non-matching rows hidden)                                                                                           |
| In-zone search                 | Filters current members by **name or callsign** (non-matching rows hidden)                                                                                                        |
| Hide filtered entries from map | One checkbox below each list; when checked and a filter is active, matching list entries are also omitted from map markers; the in-zone checkbox also trims the zone hull preview |
| Add / Remove                   | Moves selected rows between lists                                                                                                                                                 |
| Move up / down                 | Reorders selected in-zone members as a block                                                                                                                                      |
| Checkbox selection             | Multi-select on each side                                                                                                                                                         |

Channels are sorted by name on the available side. Checkbox labels show **callsign — name** when a callsign is set (`channelDisplayLabel`). Member order on the in-zone side is exactly what the user arranges — map zone hulls and future export use this order only for membership, not display sort.

## Map preview

`ZoneEditor` builds a `previewZone` from unsaved form state and passes it to `CodeplugMap` with the rest of the library zones (replacing the row being edited). Hull shape updates when members are added, removed, or reordered.

## Manual verify

1. Zone editor → add several channels, reorder with move up/down — map hull updates.
2. Save, reopen editor — order matches.
3. Remove a member — it returns to Available.
4. Type a filter on either list (name or callsign) — non-matching rows disappear from the list; with **Hide filtered entries from map** checked, they also disappear from the map (in-zone filter affects the hull preview).

## Related

- [library/README.md](README.md#zone-member-picker-25) · [map/zones.md](../map/zones.md)
- [library-routes-progress.md](../app-shell/library-routes-progress.md)
