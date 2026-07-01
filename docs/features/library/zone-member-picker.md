# Zone member picker

Deep dive for **`ZoneMemberPicker`** — the two-list channel membership editor used on the zone form.

**Tracking:** [#25](https://github.com/pskillen/codeplug-studio/issues/25)

## Purpose

Replaces checkbox-only zone membership with available ↔ in-zone lists, per-side search, add/remove, and move up/down. Saved `Zone.members` is an ordered `EntityRef[]` (`{ kind: 'channel', id }`); **picker order is export order**.

## Code anchors

| Symbol             | Path                                              | Role                       |
| ------------------ | ------------------------------------------------- | -------------------------- |
| `ZoneMemberPicker` | `src/app/components/library/ZoneMemberPicker.tsx` | Two-list UI                |
| `ZoneEditor`       | `src/app/routes/library/editors/ZoneEditor.tsx`   | Wires picker to form state |

## Behaviour

| Control            | Effect                                       |
| ------------------ | -------------------------------------------- |
| Available search   | Filters channels not yet in the zone         |
| In-zone search     | Filters current members                      |
| Add / Remove       | Moves selected rows between lists            |
| Move up / down     | Reorders selected in-zone members as a block |
| Checkbox selection | Multi-select on each side                    |

Channels are sorted by name on the available side. Member order on the in-zone side is exactly what the user arranges — map zone hulls and future export use this order only for membership, not display sort.

## Manual verify

1. Zone editor → add several channels, reorder with move up/down.
2. Save, reopen editor — order matches.
3. Remove a member — it returns to Available.

## Related

- [library/README.md](README.md#zone-member-picker-25) · [map/zones.md](../map/zones.md)
- [library-routes-progress.md](../app-shell/library-routes-progress.md)
