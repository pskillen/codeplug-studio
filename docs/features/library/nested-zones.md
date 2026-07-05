# Nested zones

Deep dive for **hierarchical zone membership** — library zones that include other zones as members, flattened at export.

**Tracking:** [#157](https://github.com/pskillen/codeplug-studio/issues/157) · Epic [#179](https://github.com/pskillen/codeplug-studio/issues/179)

## Purpose

CPS formats expose zones as **flat channel lists**. Operators may still want application-level grouping (e.g. `Scotland` contains `Glasgow` and `Edinburgh`). Studio models that hierarchy on library `Zone.members` and **denormalises** to channels when assembling a format build for export.

Nesting is **not reconstructed** from flat CPS import — it is created and maintained only in Studio (native YAML round-trips the hierarchy).

## Code anchors

| Symbol | Path | Role |
| --- | --- | --- |
| `ZoneMemberEntry` | `src/core/models/library.ts` | `kind: 'channel'` or `kind: 'zone'` members |
| `resolveEffectiveZoneChannelIds` | `src/core/domain/zoneHierarchy.ts` | Flatten to ordered, deduped channel ids |
| `zoneMembershipHasCycle` | same | Acyclic graph check |
| `validateZoneMembership` | `src/core/domain/validation.ts` | Ref + cycle validation on save |
| `assemble` | `src/core/services/assemble.ts` | Export projection uses effective channels |
| `ZoneMemberPicker` | `src/app/components/library/ZoneMemberPicker.tsx` | Channels + zones pools |

## Model semantics

| Member kind | Stored as | Export |
| --- | --- | --- |
| `channel` | `{ kind: 'channel', channelId, includeInScanList? }` | Wire channel name (after assemble) |
| `zone` | `{ kind: 'zone', zoneId }` | Expanded to child zone's effective channels, depth-first |

Rules:

- **Acyclic** — a zone cannot include itself; no cycles through zone→zone refs (validation error in zone editor).
- **Dedup** — when flattening, the same channel id appearing via multiple paths is exported once (first occurrence in walk order wins).
- **Vendor-neutral** — no radio caps in library CRUD; profile overflow **warnings** at export (existing OpenGD77/DM32 warning paths on assembled flat lists).

## Operator workflow

1. Create child zones with channel members as today.
2. Edit a parent zone → **Available zones** pool → add child zones to **In zone**.
3. Save — cycle errors surface before persistence.
4. `/library/zones` list shows direct member count; nested zones also show `(N channels effective)`.
5. Export / map hulls use the **effective** (flattened) channel set.

## Native YAML

`studioSchemaVersion: 6` — zone members serialise with `kind: channel` or `kind: zone`. Older exports with `{ channelId }` only migrate on import.

## Manual verify

1. Create zones `Glasgow`, `Edinburgh`, and parent `Scotland` with zone members.
2. Export an OpenGD77 build — parent zone `Zones.csv` row lists all flattened channel wire names.
3. Attempt `Glasgow` ⊃ `Scotland` while `Scotland` ⊃ `Glasgow` — save blocked with cycle message.
4. Export/import project YAML — nested members preserved.

## Related

- [library/README.md](README.md) · [zone-member-picker.md](zone-member-picker.md)
- [builds/zone-grouping.md](../builds/zone-grouping.md) · [map/zones.md](../map/zones.md)
