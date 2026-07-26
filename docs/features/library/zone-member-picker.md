# Zone member editor

Deep dive for **`ZoneMemberEditor`** and the split zone edit workflow.

**Tracking:** [#25](https://github.com/pskillen/codeplug-studio/issues/25), nested zones [#157](https://github.com/pskillen/codeplug-studio/issues/157), revision-2 [#180](https://github.com/pskillen/codeplug-studio/issues/180), ordering [#456](https://github.com/pskillen/codeplug-studio/issues/456), cycle UI [#188](https://github.com/pskillen/codeplug-studio/issues/188), screen split [#587](https://github.com/pskillen/codeplug-studio/issues/587), grow from map [#588](https://github.com/pskillen/codeplug-studio/issues/588)

> **Supersedes** the legacy side-by-side two-list `ZoneMemberPicker` layout (component file retained as a re-export shim).

## Purpose

Manages zone membership in a **single-column** layout, composed into focused screens when editing an existing zone:

1. **Main** — reorder-only **In this zone** list (export order).
2. **Add from list** — read-only member summary + **Other channels & zones** add pool.
3. **Configure scanning** — per-channel `includeInScanList` tri-state only.
4. **Add from map** — geographic grow suggestions ([`GrowZoneRecommendations`](../../../src/app/components/library/GrowZoneRecommendations.md)).

**Create** (`/library/zones/new`) keeps the combined **full** editor (reorder + add pool) on one page.

Saved `Zone.members` is an ordered list of `ZoneMemberEntry` values (`kind: 'channel'` or `kind: 'zone'`). Nested zones flatten at export (see [nested-zones.md](nested-zones.md)).

## Code anchors

| Symbol                           | Path                                                          | Role                              |
| -------------------------------- | ------------------------------------------------------------- | --------------------------------- |
| `zoneMembershipExclusionReasons` | `src/core/domain/zoneHierarchy.ts`                            | Self / descendant / cycle reasons |
| `ZoneMemberEditor`               | `src/app/components/library/ZoneMemberEditor.tsx`             | Vertical stacked UI (mode prop)   |
| `GrowZoneRecommendations`        | `src/app/components/library/GrowZoneRecommendations.tsx`    | Add-from-map grow UX              |
| `ZoneEditLayout`                 | `src/app/routes/library/zones/ZoneEditLayout.tsx`             | Shared draft + save shell         |
| `suggestChannelsInsideHull`      | `src/core/domain/growZone.ts`                                 | Hull-based suggestions            |
| `rankChannelsByDistance`         | `src/core/domain/growZone.ts`                                 | Locator distance ranking          |
| `SelectedItemList`               | `src/app/components/ui/SelectedItemList.tsx`                  | Generic selected-member list      |
| `AvailableItemPicker`            | `src/app/components/ui/AvailableItemPicker.tsx`               | Generic pool picker               |
| `ChannelZoneMembershipSection`   | `src/app/components/library/ChannelZoneMembershipSection.tsx` | Channel-side membership           |
| `ZoneEditor`                     | `src/app/routes/library/ZoneEditor.tsx`                       | Create-only zone form             |

Sidecars: `ZoneMemberEditor.md`, `GrowZoneRecommendations.md`, `ChannelZoneMembershipSection.md`.

## `ZoneMemberEditor` modes

| Mode | In-zone list | Add pool | Scan controls | Reorder / remove |
| --- | --- | --- | --- | --- |
| `full` | yes | yes | yes | yes |
| `reorder` | yes | no | no | yes |
| `addPool` | read-only | yes | no | no |
| `scanOnly` | read-only | no | yes | no |
| `summary` | read-only | no | no | no |

## Behaviour

| Control                      | Effect                                                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| In-zone filter               | Filters current members (channel name/callsign or zone name)                                                                                                 |
| Other pool filter            | Filters available channels and zones                                                                                                                         |
| Add selected                 | Appends checked rows from the other pool                                                                                                                     |
| Move up / down / drag        | Reorders selected in-zone members; drag handles when filter clear; **Alt+↑ / Alt+↓** via kit                                                                 |
| Sort channels…               | One-shot rewrite of membership order (name / callsign / duplex / band / mode) after confirm — [#456](https://github.com/pskillen/codeplug-studio/issues/456) |
| Remove                       | Per-row ✕ or bulk **Remove selected** (kit built-in)                                                                                                         |
| Zone-derived scan membership | Per direct channel member — tri-state `includeInScanList` (`default` / `include` / `skip`)                                                                   |
| Hide filtered from map       | Separate checkboxes for each pool                                                                                                                            |

**Available zones** keep the zone being edited, its descendants under the current membership, and cycle-closing candidates **visible** in the pool — greyed out with a reason badge (`This zone` / `Already nested under this zone` / `Would create a cycle`) and not selectable for add ([#188](https://github.com/pskillen/codeplug-studio/issues/188)). Zones already in the member list appear only on the in-zone side. Save still runs `validateZoneMembership` as a backstop.

Channel rows show callsign/name, RX/TX, mode pills, scan-skip badge. Zone rows show effective channel count and link to the nested zone editor.

## Grow from map ([#588](https://github.com/pskillen/codeplug-studio/issues/588))

On `/library/zones/:id/add-from-map`:

- **Inside hull** — non-member geolocated channels inside the zone’s convex hull (or 2.5 km circle for a single member site; no area for two sites).
- **Near locator** — all non-members ranked by distance from a locator (default: arithmetic mean of member coordinates).
- Locator criteria: Maidenhead, map click, geocode, **Use my location**, channel pick, reset to zone centre.
- Multi-select suggestions → append via `addChannelsToZoneMembers` into the shell draft (save on main screen).

Suggestions are an on-demand snapshot — membership does not auto-update when channels move.

## Channel editor cross-link

`ChannelZoneMembershipSection` on `/library/channels/:id` lists zones whose effective membership includes the channel. Direct memberships can be removed or new zones added via `ZoneSelect` — each action persists immediately with `putZone`.

## Map preview

Sub-screens that include a map build a `previewZone` from unsaved shell state. Hull shape uses `resolveEffectiveZoneChannelIds` — nested zone members contribute their descendant channels. Non-member geolocated channels are dimmed; co-located stacks that also include an in-zone member stay full opacity ([#469](https://github.com/pskillen/codeplug-studio/issues/469)).

## Manual verify

1. Edit zone → main view reorders members only; scan controls absent.
2. **Add from channel list** → add pool + read-only members; map updates.
3. **Configure zone scanning** → tri-state per channel; no reorder or add/remove.
4. **Add from map** → inside-hull suggestions when ≥3 member sites; near-locator sorted list; multi-add updates draft; save persists.
5. **New zone** (`/library/zones/new`) — full editor still works; after save, sub-routes available at `/library/zones/:id/…`.
6. Channels list → **New zone from selected** — create flow pre-fills members ([#154](https://github.com/pskillen/codeplug-studio/issues/154)).

## Related

- [library/README.md](README.md) · [nested-zones.md](nested-zones.md) · [map/zones.md](../map/zones.md)
- Zone management: [#179](https://github.com/pskillen/codeplug-studio/issues/179) / [#180](https://github.com/pskillen/codeplug-studio/issues/180)
