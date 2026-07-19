# Nested zones

Deep dive for **hierarchical zone membership** — library zones that include other zones as members, flattened at export.

**Tracking:** [#157](https://github.com/pskillen/codeplug-studio/issues/157) · Epic [#179](https://github.com/pskillen/codeplug-studio/issues/179) · UI cycle prevention [#188](https://github.com/pskillen/codeplug-studio/issues/188)

## Purpose

CPS formats expose zones as **flat channel lists**. Operators may still want application-level grouping (e.g. `Scotland` contains `Glasgow` and `Edinburgh`). Studio models that hierarchy on library `Zone.members` and **denormalises** to channels when assembling a format build for export.

Nesting is **not reconstructed** from flat CPS import — it is created and maintained only in Studio (native YAML round-trips the hierarchy).

## Code anchors

| Symbol                           | Path                                              | Role                                           |
| -------------------------------- | ------------------------------------------------- | ---------------------------------------------- |
| `ZoneMemberEntry`                | `src/core/models/library.ts`                      | `kind: 'channel'` or `kind: 'zone'` members    |
| `Zone.omitFromExport`            | same                                              | Skip standalone `Zones.csv` row                |
| `flattenZoneMembership`          | `src/core/domain/zoneHierarchy.ts`                | Cycle-safe flatten with warnings               |
| `resolveEffectiveZoneChannelIds` | same                                              | Flatten to ordered, deduped channel ids        |
| `collectZoneFlattenWarnings`     | same                                              | Cycle warnings for export                      |
| `zoneMembershipHasCycle`         | same                                              | Acyclic graph check                            |
| `zoneMembershipExclusionReasons` | same                                              | Self / descendant / cycle-closer reasons       |
| `validateZoneMembership`         | `src/core/domain/validation.ts`                   | Ref + cycle validation on save                 |
| `assemble`                       | `src/core/services/assemble.ts`                   | Export projection uses effective channels      |
| `orderChannelIdsByLayoutHint`    | `src/core/domain/zoneGroupingLayout.ts`           | Optional member order from build layout        |
| `ZoneMemberEditor`               | `src/app/components/library/ZoneMemberEditor.tsx` | Channels + zones pools (blocked rows labelled) |

## Model semantics

| Member kind | Stored as                                            | Export                                                   |
| ----------- | ---------------------------------------------------- | -------------------------------------------------------- |
| `channel`   | `{ kind: 'channel', channelId, includeInScanList? }` | Wire channel name (after assemble)                       |
| `zone`      | `{ kind: 'zone', zoneId }`                           | Expanded to child zone's effective channels, depth-first |

| Zone field       | Default | Export effect                                                                                                                                                                                                                                                                                       |
| ---------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `omitFromExport` | off     | When on: no row in `Zones.csv`; channels flatten into parent zone rows. Channels export only when reachable via a parent zone — standalone omit-only zones do not export their channels unless a build sets `forceInclude` on the zone override (see [wire-preview.md](../builds/wire-preview.md)). |

Rules:

- **Acyclic** — a zone cannot include itself; no cycles through zone→zone refs. The zone member editor **blocks** self, descendants, and cycle-closing candidates in the available pool (rows stay visible, greyed, with a reason badge — [#188](https://github.com/pskillen/codeplug-studio/issues/188)). Save still runs `validateZoneMembership` as a persistence backstop.
- **Runtime cycles** — if corrupt or legacy data already contains a cycle, flatten skips the revisiting branch (**partial flatten**), keeps channels collected before the cycle point, and surfaces an export warning ([#187](https://github.com/pskillen/codeplug-studio/issues/187)). Map and CSV preview do not crash.
- **Dedup** — when flattening, the same channel id appearing via multiple paths is exported once (first occurrence in walk order wins).
- **Vendor-neutral** — no radio caps in library CRUD; profile overflow **warnings** at export (existing OpenGD77/DM32 warning paths on assembled flat lists).
- **Library is membership source of truth** — `assemble` always derives zone `memberChannelIds` from live library membership (`resolveEffectiveZoneChannelIds`), even when the build has a persisted `zoneGrouping` section. Layout `channelIds` are an **order hint** only (see [zone-grouping.md](../builds/zone-grouping.md)).

## Operator workflow

1. Create child zones with channel members as today.
2. Edit a parent zone → **Available zones** pool → add child zones to **In zone**.
3. Optionally enable **Don't export as its own zone** on a child zone used only as a building block (e.g. PMR446 simplex set nested inside every city zone).
4. Save — cycle errors surface before persistence.
5. `/library/zones` list shows direct member summary (e.g. `3 channels + 1 zone`); **Nested only** badge when `omitFromExport` is set.
6. Export / map hulls use the **effective** (flattened) channel set.

## Native YAML

`studioSchemaVersion: 7` — zone members serialise with `kind: channel` or `kind: zone`; optional `omitFromExport: true` (sparse). Imports accept v6+; v6 exports with `{ channelId }` only migrate on import.

## Manual verify

1. Create zones **PMR446** (channel members) and **Glasgow** (Glasgow channels + nested PMR446 zone member).
2. Export OpenGD77 and DM32 builds — **Glasgow** `Zones.csv` row includes PMR channels; **PMR446** row present.
3. Enable **Don't export as its own zone** on PMR446 — re-export; PMR446 row absent; Glasgow row still includes PMR channels.
4. On a format build **Zones** wire-preview page, enable **Force export** for PMR446 — re-export; PMR446 standalone row appears in this build only (library `omitFromExport` unchanged).
5. With **Omit channels not in a zone** enabled on export, PMR channels remain included (linked via nested flatten).
6. Attempt `Glasgow` ⊃ `Scotland` while `Scotland` ⊃ `Glasgow` — Scotland appears in the available pool greyed with **Would create a cycle**; cannot be selected or added; save still blocked with cycle message if membership is forced.
7. If cyclic membership exists in stored data (e.g. manual YAML edit), export and map still load; **Export warnings** list a cycle message and flattened zones use partial membership.
8. Export/import project YAML — nested members, `omitFromExport`, and `forceInclude` on zone overrides preserved.

## Related

- [library/README.md](README.md) · [zone-member-picker.md](zone-member-picker.md)
- [builds/zone-grouping.md](../builds/zone-grouping.md) · [map/zones.md](../map/zones.md)
