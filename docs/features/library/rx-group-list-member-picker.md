# RX group list member picker

Deep dive for **`RxGroupListMemberPicker`** — mk2 E6 membership editor on the Receive Group List form.

**Tracking:** [#107](https://github.com/pskillen/codeplug-studio/issues/107) · [#108](https://github.com/pskillen/codeplug-studio/issues/108) · ordering [#456](https://github.com/pskillen/codeplug-studio/issues/456) · r2 E6 [#942](https://github.com/pskillen/codeplug-studio/issues/942)

## Purpose

Curate ordered RX group list membership with **`MembershipPanel`** + **`AddMembersScreen`**. Saved `RxGroupList.members` is an ordered `RxGroupListMember[]`; panel order is export order. Per-member DMR timeslot override is a trailing v2 `SegmentedControl` on member rows.

## Code anchors

| Symbol                         | Path                                                     | Role                   |
| ------------------------------ | -------------------------------------------------------- | ---------------------- |
| `RxGroupListMemberPicker`      | `src/app/components/library/RxGroupListMemberPicker.tsx`   | Members panel          |
| `RxGroupListAddOverlay`        | `src/app/components/library/RxGroupListMemberPicker.tsx` | Add pool overlay       |
| `RxGroupListEditor`            | `src/app/routes/library/RxGroupListEditor.tsx`           | EditorHeader + wiring  |
| `rxGroupListMembers`           | `src/app/lib/rxGroupListMembers.ts`                      | Display + slot helpers |
| `reorderRxGroupListMembers`    | `src/core/domain/membershipOrder.ts`                     | Block move             |
| `sortRxGroupListMembersByMode` | `src/core/domain/membershipSort.ts`                      | Permanent Sort…        |

## Behaviour

| Control               | Effect                                                                            |
| --------------------- | --------------------------------------------------------------------------------- |
| Find in list          | Filters members; disables drag / bulk move while active                           |
| Add members           | `AddMembersScreen` — Talk groups + Digital contacts sections                      |
| Drag / bulk move      | Reorders members; key remap preserves `timeSlotOverride`                          |
| Sort members…         | One-shot rewrite by name or callsign after confirm                                |
| Timeslot (row trailing) | `Auto` / `TS1` / `TS2` on DMR-capable members                                   |
| Per-row / bulk remove | Removes from the list                                                             |

`Auto` omits `timeSlotOverride` (unset). `TS1` / `TS2` store typed `1` / `2` on the membership row — vendor-neutral; CPS wire mapping is deferred to format export.

## Manual verify

1. Receive Group List editor → add talk group + digital contact via overlay, drag-reorder — save and reopen; order matches.
2. Set TS1 on a talk group member — save and reopen; slot persists.
3. Filter on member list — reorder disabled; clear filter restores.
4. Narrow viewport — add overlay is full-screen takeover.

## Related

- [library/README.md](README.md) · [zone-member-picker.md](zone-member-picker.md) · [lists-and-ordering](../../reference/styleguide/lists-and-ordering.md)
- [RxGroupListSummary sidecar](../../../src/app/components/library/RxGroupListSummary.md) — channel DMR tab preview
