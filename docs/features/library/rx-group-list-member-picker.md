# RX group list member picker

Deep dive for **`RxGroupListMemberPicker`** — B+C membership editor on the Receive Group List form (same kit shells as Zones / Scan lists).

**Tracking:** [#107](https://github.com/pskillen/codeplug-studio/issues/107) · [#108](https://github.com/pskillen/codeplug-studio/issues/108) · ordering [#456](https://github.com/pskillen/codeplug-studio/issues/456) · B+C migration [#470](https://github.com/pskillen/codeplug-studio/issues/470)

## Purpose

Curate ordered RX group list membership with **C** (`SelectedItemList` — In this list) above **B** (`AvailableItemPicker` — Other talk groups & contacts). Saved `RxGroupList.members` is an ordered `RxGroupListMember[]`; **C order is export order**. Per-member DMR timeslot override lives in C row chrome.

## Code anchors

| Symbol                         | Path                                                     | Role                   |
| ------------------------------ | -------------------------------------------------------- | ---------------------- |
| `RxGroupListMemberPicker`      | `src/app/components/library/RxGroupListMemberPicker.tsx` | B+C UI                 |
| `RxGroupListEditor`            | `src/app/routes/library/RxGroupListEditor.tsx`           | Picker wiring          |
| `rxGroupListMembers`           | `src/app/lib/rxGroupListMembers.ts`                      | Display + slot helpers |
| `reorderRxGroupListMembers`    | `src/core/domain/membershipOrder.ts`                     | Block move             |
| `sortRxGroupListMembersByMode` | `src/core/domain/membershipSort.ts`                      | Permanent Sort…        |

## Behaviour

| Control               | Effect                                                                            |
| --------------------- | --------------------------------------------------------------------------------- |
| C filter              | Find-in-list; disables drag / move / Sort while active                            |
| B filter              | Filters talk groups and digital contacts not yet in the list (name or digital ID) |
| B Add selected        | Appends staged `{ ref }` members                                                  |
| C drag / Move         | Reorders members; key remap preserves `timeSlotOverride`                          |
| Sort members…         | One-shot rewrite by name or callsign after confirm                                |
| Timeslot (C rows)     | `Auto` / `TS1` / `TS2` on DMR talk groups and DMR digital contacts                |
| Per-row / bulk remove | Removes from the list                                                             |

`Auto` omits `timeSlotOverride` (unset). `TS1` / `TS2` store typed `1` / `2` on the membership row — vendor-neutral; CPS wire mapping is deferred to format export.

## Manual verify

1. Receive Group List editor → add talk group + digital contact from B, drag-reorder on C — save and reopen; order matches.
2. Set TS1 on a talk group member — save and reopen; slot persists.
3. Filter on C — reorder disabled; clear filter restores.
4. BrandMeister-imported list — existing slots visible and editable.

## Related

- [library/README.md](README.md) · [zone-member-picker.md](zone-member-picker.md) · [lists-and-ordering](../../reference/styleguide/lists-and-ordering.md)
- [RxGroupListSummary sidecar](../../src/app/components/library/RxGroupListSummary.md) — channel DMR tab preview
