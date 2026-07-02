# RX group list member picker

Deep dive for **`RxGroupListMemberPicker`** — the two-list membership editor used on the RX group list form.

**Tracking:** [#107](https://github.com/pskillen/codeplug-studio/issues/107) · [#108](https://github.com/pskillen/codeplug-studio/issues/108)

## Purpose

Replaces checkbox-only RX group list membership with available ↔ in-list lists, per-side search, add/remove, reorder, and per-member DMR timeslot override. Saved `RxGroupList.members` is an ordered `RxGroupListMember[]`; **picker order is export order**.

## Code anchors

| Symbol                    | Path                                                     | Role                   |
| ------------------------- | -------------------------------------------------------- | ---------------------- |
| `RxGroupListMemberPicker` | `src/app/components/library/RxGroupListMemberPicker.tsx` | Two-list UI            |
| `RxGroupListEditor`       | `src/app/routes/library/RxGroupListEditor.tsx`           | Picker wiring          |
| `rxGroupListMembers`      | `src/app/lib/rxGroupListMembers.ts`                      | Display + slot helpers |

## Behaviour

| Control            | Effect                                                                               |
| ------------------ | ------------------------------------------------------------------------------------ |
| Available search   | Filters talk groups and digital contacts not yet in the list (name or digital ID)    |
| In-list search     | Filters current members                                                              |
| Add / Remove       | Moves selected rows between lists                                                    |
| Move up / down     | Reorders selected in-list members as a block                                         |
| Timeslot (in-list) | `Auto` / `TS1` / `TS2` segmented control on DMR talk groups and DMR digital contacts |

`Auto` omits `timeSlotOverride` (unset). `TS1` / `TS2` store typed `1` / `2` on the membership row — vendor-neutral; CPS wire mapping is deferred to format export.

## Manual verify

1. RX group list editor → add talk group + digital contact, reorder — save and reopen; order matches.
2. Set TS1 on a talk group member — save and reopen; slot persists.
3. BrandMeister-imported list — existing slots visible and editable.

## Related

- [library/README.md](README.md) · [zone-member-picker.md](zone-member-picker.md)
- [RxGroupListSummary sidecar](../../src/app/components/library/RxGroupListSummary.md) — channel DMR tab preview
