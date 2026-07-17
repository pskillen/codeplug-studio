# Zone member editor

Deep dive for **`ZoneMemberEditor`** — the vertical stacked membership editor on the zone form.

**Tracking:** [#25](https://github.com/pskillen/codeplug-studio/issues/25), nested zones [#157](https://github.com/pskillen/codeplug-studio/issues/157), revision-2 [#180](https://github.com/pskillen/codeplug-studio/issues/180), ordering [#456](https://github.com/pskillen/codeplug-studio/issues/456)

> **Supersedes** the legacy side-by-side two-list `ZoneMemberPicker` layout (component file retained as a re-export shim).

## Purpose

Manages zone membership in a **single-column** layout:

1. **In this zone** — export-order member list with rich channel rows, nested zone rows, reorder, per-channel `includeInScanList`.
2. **Other channels & zones** — filterable add pool below (not side-by-side).

Saved `Zone.members` is an ordered list of `ZoneMemberEntry` values (`kind: 'channel'` or `kind: 'zone'`). Nested zones flatten at export (see [nested-zones.md](nested-zones.md)).

The zone editor embeds **`CodeplugMap`** below the editor so hull geometry updates from the **effective** (flattened) channel set.

## Code anchors

| Symbol                         | Path                                                          | Role                         |
| ------------------------------ | ------------------------------------------------------------- | ---------------------------- |
| `ZoneMemberEditor`             | `src/app/components/library/ZoneMemberEditor.tsx`             | Vertical stacked UI          |
| `SelectedItemList`             | `src/app/components/ui/SelectedItemList.tsx`                  | Generic selected-member list |
| `AvailableItemPicker`          | `src/app/components/ui/AvailableItemPicker.tsx`               | Generic pool picker          |
| `zoneMemberPickerUtils`        | `src/app/components/library/zoneMemberPickerUtils.ts`         | Map filter helpers           |
| `ChannelZoneMembershipSection` | `src/app/components/library/ChannelZoneMembershipSection.tsx` | Channel-side membership      |
| `ZoneEditor`                   | `src/app/routes/library/ZoneEditor.tsx`                       | Editor + live map preview    |

Sidecars: `ZoneMemberEditor.md`, `ChannelZoneMembershipSection.md`.

## Behaviour

| Control                      | Effect                                                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| In-zone filter               | Filters current members (channel name/callsign or zone name)                                                                                                 |
| Other pool filter            | Filters available channels and zones                                                                                                                         |
| Add selected                 | Appends checked rows from the other pool                                                                                                                     |
| Move up / down / drag        | Reorders selected in-zone members; drag handles when filter clear; **Alt+↑ / Alt+↓** via kit                                                                 |
| Sort…                        | One-shot rewrite of membership order (name / callsign / duplex / band / mode) after confirm — [#456](https://github.com/pskillen/codeplug-studio/issues/456) |
| Remove                       | Per-row ✕ or bulk **Remove selected** (kit built-in)                                                                                                         |
| Zone-derived scan membership | Per direct channel member — tri-state `includeInScanList` (`default` / `include` / `skip`)                                                                   |
| Hide filtered from map       | Separate checkboxes for each pool                                                                                                                            |

**Available zones** excludes the zone being edited, its descendant zones (would create a cycle), and zones already in the member list.

Channel rows show callsign/name, RX/TX, mode pills, scan-skip badge. Zone rows show effective channel count and link to the nested zone editor.

## Channel editor cross-link

`ChannelZoneMembershipSection` on `/library/channels/:id` lists zones whose effective membership includes the channel. Direct memberships can be removed or new zones added via `ZoneSelect` — each action persists immediately with `putZone`.

## Map preview

`ZoneEditor` builds a `previewZone` from unsaved form state and passes it to `CodeplugMap`. Hull shape uses `resolveEffectiveZoneChannelIds` — nested zone members contribute their descendant channels. Non-member geolocated channels are dimmed.

## Manual verify

1. Zone editor → add channels and a child zone, reorder with move up/down — map hull updates.
2. Toggle **Scan list** on a channel member — save, reopen — flag persists.
3. Channel editor → zone membership section → add/remove zone — list updates without saving channel fields.
4. Channels list → **Zones** column badges; delete icon with zone cascade confirm.
5. Channels list → select rows → **New zone from selected** — zone editor opens pre-filled ([#154](https://github.com/pskillen/codeplug-studio/issues/154)).

## Related

- [library/README.md](README.md) · [nested-zones.md](nested-zones.md) · [map/zones.md](../map/zones.md)
- [library-zones-revision-2-progress.md](library-zones-revision-2-progress.md)
