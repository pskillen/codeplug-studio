# Zone member editor

Deep dive for **`ZoneMemberEditor`** and the mk2 zone edit workspace (E2).

**Tracking:** [#25](https://github.com/pskillen/codeplug-studio/issues/25), nested zones [#157](https://github.com/pskillen/codeplug-studio/issues/157), revision-2 [#180](https://github.com/pskillen/codeplug-studio/issues/180), r2 E2 [#942](https://github.com/pskillen/codeplug-studio/issues/942)

> **Supersedes** the legacy side-by-side two-list `ZoneMemberPicker` layout and the pre-r2 route-split add/scanning screens ([#587](https://github.com/pskillen/codeplug-studio/issues/587)).

## Purpose

Manages zone membership on the **Membership** family (`MembershipPanel`, `MembershipRow`, `AddMembersScreen`, `MembershipPoolRow`). The zone edit workspace (`/library/zones/:id`) is one coherent screen:

1. **Members** — reorderable list (export order) with find-in-list, Sort…, bulk move/remove, drag; **Add members** opens the pool overlay.
2. **Coverage** — map stack (C7) beside members on desktop; stacked on narrow.
3. **Scanning behaviour** — per direct channel member Auto / Force / Skip (`includeInScanList`); not on member rows.

**Create** (`/library/zones/new`) uses `mode="full"` — members panel + inline add pool.

Legacy routes `/library/zones/:id/add` and `/scanning` redirect to the main workspace (`?add=members` / `#scanning`).

Saved `Zone.members` is an ordered list of `ZoneMemberEntry` values (`kind: 'channel'` or `kind: 'zone'`). Nested zones flatten at export (see [nested-zones.md](nested-zones.md)).

## Code anchors

| Symbol                           | Path                                                          | Role                              |
| -------------------------------- | ------------------------------------------------------------- | --------------------------------- |
| `zoneMembershipExclusionReasons` | `src/core/domain/zoneHierarchy.ts`                            | Self / descendant / cycle reasons |
| `ZoneMemberEditor`               | `src/app/components/library/ZoneMemberEditor.tsx`             | Members + scanning modes          |
| `ZoneMemberAddOverlay`           | `src/app/components/library/ZoneMemberEditor.tsx`             | `AddMembersScreen` wrapper        |
| `ZoneMemberAddPool`              | `src/app/components/library/ZoneMemberAddPool.tsx`            | Pool row rendering                |
| `ZoneEditLayout`                 | `src/app/routes/library/zones/ZoneEditLayout.tsx`             | EditorHeader + StickyFooter shell |
| `ZoneEditMainPage`               | `src/app/routes/library/zones/ZoneEditMainPage.tsx`           | E2 workspace composition          |
| `GrowZoneRecommendations`        | `src/app/components/library/GrowZoneRecommendations.tsx`      | Add-from-map grow UX              |
| `ChannelZoneMembershipSection`   | `src/app/components/library/ChannelZoneMembershipSection.tsx` | Channel-side inverse membership   |
| `ZoneEditor`                     | `src/app/routes/library/ZoneEditor.tsx`                       | Create-only zone form             |

Sidecars: `ZoneMemberEditor.md`, `GrowZoneRecommendations.md`, `ChannelZoneMembershipSection.md`.

## `ZoneMemberEditor` modes

| Mode        | Role                                                                 |
| ----------- | -------------------------------------------------------------------- |
| `members`   | Main panel — reorder, find, Sort…, bulk; `onAdd` opens overlay       |
| `scanning`  | Scanning behaviour panel — Auto / Force / Skip per channel member    |
| `summary`   | Read-only member list                                                |
| `full`      | Create — members + inline pool (no overlay)                          |
| `pool`      | Legacy shim — inline pool only                                       |

Deprecated aliases: `reorder` → `members`, `scanOnly` → `scanning`, `addPool` → `pool`.

## Behaviour

| Control                      | Effect                                                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Find in list                 | Filters current members; disables drag / bulk move while active                                                                                                |
| Add members                  | Opens `AddMembersScreen` — Channels + Zones sections; blocked nested zones visible with reason                                                               |
| Move up / down / drag        | Reorders selected in-zone members; **Alt+↑ / Alt+↓** via bulk reorder kit                                                                                    |
| Sort channels…               | One-shot rewrite of membership order after confirm — [#456](https://github.com/pskillen/codeplug-studio/issues/456)                                          |
| Remove                       | Per-row ✕ or bulk **Remove selected**                                                                                                                        |
| Scanning behaviour           | Per direct channel member — Auto (`default`) / Force (`include`) / Skip (`skip`)                                                                             |
| Blocked nested zones         | Greyed in pool with reason badge; cannot stage or add                                                                                                        |

## Related

- [library/README.md](README.md) · [nested-zones.md](nested-zones.md) · [design-system-v2](../design-system-v2/README.md)
- [MembershipPanel sidecar](../../../src/app/components/v2/MembershipPanel.md)
